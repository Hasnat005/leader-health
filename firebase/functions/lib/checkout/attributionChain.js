/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

/**
 * v2 attribution chain walk and commission math (doc 17 Steps 3–5).
 */

const logger = require("firebase-functions/logger");
const {AFFILIATE_PROFILES, isEffectivelyInactive} = require("../promo/affiliate.js");
const {
  COMMISSION_TYPE_FIXED,
  computeCommissionCentsFromSnapshots,
  coerceCommissionRateFromFirestore,
  coerceCommissionFixedCentsFromFirestore,
  normalizeCommissionType,
} = require("./commissionModel.js");

/**
 * @param {*} snap
 * @return {string}
 */
function profileTier(snap) {
  const d = snap.exists && typeof snap.data === "function" ? snap.data() : null;
  const t = d && d.tier ? String(d.tier).trim().toLowerCase() : "";
  if (t === "super" || t === "sub" || t === "micro") return t;
  return "";
}

/**
 * Walk from chainLeafId up to root Super; anchor-first order.
 *
 * @param {*} db
 * @param {string} chainLeafId
 * @return {Promise<{ profiles: import("firebase-admin/firestore").DocumentSnapshot[] } | { profiles: null, reason: string }>}
 */
async function walkChainProfiles(db, chainLeafId) {
  /** @type {import("firebase-admin/firestore").DocumentSnapshot[]} */
  const chainProfiles = [];
  let currentId = chainLeafId;

  while (currentId) {
    const profSnap = await db.collection(AFFILIATE_PROFILES).doc(currentId).get();

    if (!profSnap.exists) {
      const reason =
        currentId === chainLeafId ?
          "resolved_affiliate_paused_or_missing" :
          "chain_ancestor_paused_or_deleted";
      return {profiles: null, reason};
    }

    if (isEffectivelyInactive(profSnap)) {
      const reason =
        currentId === chainLeafId ?
          "resolved_affiliate_paused_or_missing" :
          "chain_ancestor_paused_or_deleted";
      return {profiles: null, reason};
    }

    chainProfiles.push(profSnap);

    const rootSuper = String(profSnap.get("rootSuperAffiliateId") || "").trim();
    if (currentId === rootSuper) {
      break;
    }

    const parentId = String(profSnap.get("parentAffiliateId") || "").trim();
    const tier = profileTier(profSnap);
    if (!parentId && tier !== "super") {
      return {profiles: null, reason: "chain_ancestor_paused_or_deleted"};
    }
    currentId = parentId || null;
  }

  if (chainProfiles.length === 0) {
    return {profiles: null, reason: "resolved_affiliate_paused_or_missing"};
  }

  if (chainProfiles.length > 3) {
    logger.error("buildChainEntries: chain depth exceeds 3", {
      chainLeafId,
      depth: chainProfiles.length,
    });
    return {profiles: null, reason: "chain_ancestor_paused_or_deleted"};
  }

  const lastTier = profileTier(chainProfiles[chainProfiles.length - 1]);
  if (lastTier !== "super") {
    return {profiles: null, reason: "chain_ancestor_paused_or_deleted"};
  }

  return {profiles: chainProfiles};
}

/**
 * @param {import("firebase-admin/firestore").DocumentSnapshot} profSnap
 * @return {{
 *   commissionType: string,
 *   commissionRateSnapshot: number | null,
 *   commissionFixedCentsSnapshot: number | null,
 * }}
 */
function commissionSnapshotsFromProfile(profSnap) {
  const pdata = typeof profSnap.data === "function" ? profSnap.data() : null;
  const commType = normalizeCommissionType(pdata && pdata.commissionType);
  const cr = coerceCommissionRateFromFirestore(pdata && pdata.commissionRate);
  const fcRaw = coerceCommissionFixedCentsFromFirestore(
      pdata && pdata.commissionFixedCents,
  );
  if (commType === COMMISSION_TYPE_FIXED) {
    return {
      commissionType: "fixed",
      commissionRateSnapshot: null,
      commissionFixedCentsSnapshot: fcRaw,
    };
  }
  return {
    commissionType: "percentage",
    commissionRateSnapshot: cr,
    commissionFixedCentsSnapshot: null,
  };
}

/**
 * Steps 3–5: chain walk, gross top-down, net per tier.
 *
 * @param {*} db Firestore
 * @param {string} chainLeafId
 * @param {number} originalAmountCents
 * @return {Promise<{
 *   chain: Record<string, unknown>[] | null,
 *   anchorAffiliateId: string | null,
 *   rootSuperAffiliateId: string | null,
 *   totalChainCommissionCents: number,
 *   reason?: string,
 * }>}
 */
async function buildChainEntries(db, chainLeafId, originalAmountCents) {
  const walk = await walkChainProfiles(db, chainLeafId);
  if (!walk.profiles) {
    return {
      chain: null,
      anchorAffiliateId: null,
      rootSuperAffiliateId: null,
      totalChainCommissionCents: 0,
      reason: walk.reason,
    };
  }

  const chainProfiles = walk.profiles;
  const baseProductCents = Math.max(
      0,
      Math.round(
          typeof originalAmountCents === "number" && Number.isFinite(originalAmountCents) ?
            originalAmountCents :
            0,
      ),
  );

  const superSnap = chainProfiles[chainProfiles.length - 1];
  const superData = typeof superSnap.data === "function" ? superSnap.data() : null;

  /** @type {Map<string, number>} */
  const grossByAffiliateId = new Map();

  const superGross = computeCommissionCentsFromSnapshots({
    commissionTypeSnapshot: superData && superData.commissionType,
    commissionFixedCentsSnapshot: superData && superData.commissionFixedCents,
    commissionRateSnapshot: superData && superData.commissionRate,
    originalAmountCents: baseProductCents,
  });
  grossByAffiliateId.set(superSnap.id, superGross);

  for (let i = chainProfiles.length - 2; i >= 0; i--) {
    const childSnap = chainProfiles[i];
    const parentSnap = chainProfiles[i + 1];
    const parentGross = grossByAffiliateId.get(parentSnap.id) ?? 0;
    const childData = typeof childSnap.data === "function" ? childSnap.data() : null;
    const childTier = profileTier(childSnap);
    let childGross = 0;
    if (childTier === "sub" || childTier === "micro") {
      const rate = coerceCommissionRateFromFirestore(childData && childData.commissionRate) ?? 0;
      childGross = Math.round(parentGross * rate / 100);
    }
    grossByAffiliateId.set(childSnap.id, childGross);
  }

  const totalChainCommissionCents = grossByAffiliateId.get(superSnap.id) ?? 0;

  /** @type {Record<string, unknown>[]} */
  const chain = [];

  for (let i = 0; i < chainProfiles.length; i++) {
    const profSnap = chainProfiles[i];
    const affiliateId = profSnap.id;
    const gross = grossByAffiliateId.get(affiliateId) ?? 0;
    const childGross =
      i > 0 ? grossByAffiliateId.get(chainProfiles[i - 1].id) ?? 0 : 0;
    const net = gross - childGross;

    const tier = profileTier(profSnap);
    const snaps = commissionSnapshotsFromProfile(profSnap);
    const parentGross =
      i < chainProfiles.length - 1 ?
        grossByAffiliateId.get(chainProfiles[i + 1].id) ?? 0 :
        baseProductCents;
    const commissionBaseCents =
      tier === "super" ? baseProductCents : parentGross;

    const utmSlug = String(profSnap.get("utmSlug") || "").trim();

    chain.push({
      tier,
      affiliateId,
      utmSlug,
      commissionType: snaps.commissionType,
      commissionRateSnapshot: snaps.commissionRateSnapshot,
      commissionFixedCentsSnapshot: snaps.commissionFixedCentsSnapshot,
      commissionBaseCents,
      commissionGrossCents: gross,
      commissionNetCents: net,
    });
  }

  return {
    chain,
    anchorAffiliateId: chainProfiles[0].id,
    rootSuperAffiliateId: superSnap.id,
    totalChainCommissionCents,
  };
}

module.exports = {buildChainEntries};

/* eslint-enable valid-jsdoc, max-len, require-jsdoc */
