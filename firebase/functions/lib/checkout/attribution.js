/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

/**
 * ADR-002 server-side attribution resolver (v2).
 *
 * Determines which affiliate chain (if any) earns commission for a checkout.
 * Promo discount logic is separate; this module only decides attribution.
 *
 * GA4 is never consulted for commission decisions (docs/10 §4.3).
 */

const {
  parseClientAttributionSnapshot,
  normalizePromoCodeId,
  normalizeUtmSlug,
  normalizePromoState,
} = require("../promo/normalize.js");
const {buildChainEntries} = require("./attributionChain.js");
const {
  AFFILIATE_PROFILES,
  findAffiliateProfileBySlug,
  isEffectivelyInactive,
  affiliateInOwnerTree,
  findActiveOwnerAffiliateId,
  isPromoAssignmentActive,
} = require("../promo/affiliate.js");

const PROMO_CODES = "PromoCodes";

/**
 * @param {*} db Firestore
 * @param {{
 *   attributionSnapshot: unknown,
 *   promoCodeEntered: unknown,
 *   allowNoPromoUtm: boolean,
 *   originalAmountCents?: unknown,
 * }} input
 * @return {Promise<{ attribution: Record<string, unknown> }>}
 */
async function resolveCheckoutAttribution(db, input) {
  const allowNoPromoUtm = Boolean(input.allowNoPromoUtm);
  const rawBase = input.originalAmountCents;
  const originalAmountCents =
    typeof rawBase === "number" && Number.isFinite(rawBase) && rawBase > 0 ?
      Math.round(rawBase) :
      0;

  const parsed = parseClientAttributionSnapshot(input.attributionSnapshot);
  const promoEntered = normalizePromoCodeId(
      typeof input.promoCodeEntered === "string" ? input.promoCodeEntered : "",
  );

  const rawUtmOut = {
    source: parsed.source ? normalizeUtmSlug(parsed.source) : "",
    medium: parsed.medium || "",
    campaign: String(parsed.campaign || "").trim(),
  };

  let utmAffiliateId = /** @type {string | null} */ (null);
  let utmResolutionNote = "no_affiliate_utm_in_request";
  /** @type {import("firebase-admin/firestore").DocumentSnapshot | null} */
  let utmAffSnap = null;

  if (parsed.medium === "affiliate" && parsed.source) {
    const prof = await findAffiliateProfileBySlug(db, parsed.source);
    if (!prof) {
      utmResolutionNote = "invalid_utm_slug";
    } else if (isEffectivelyInactive(prof)) {
      utmResolutionNote = "paused_affiliate_utm";
    } else {
      utmAffiliateId = prof.id;
      utmAffSnap = prof;
      utmResolutionNote = "utm_resolved";
    }
  } else if (parsed.source || parsed.campaign || parsed.medium) {
    utmResolutionNote = "utm_medium_not_affiliate_or_missing_source";
  }

  /** @type {string | null} */
  let chainLeafId = null;
  /** @type {string} */
  let attributionStatus = "unattributed";
  /** @type {string} */
  let attributionReason = "default";

  if (promoEntered) {
    const promoRef = db.collection(PROMO_CODES).doc(promoEntered);
    const promoSnap = await promoRef.get();
    if (!promoSnap.exists) {
      attributionReason = "invalid_promo_code";
    } else {
      const pdata = promoSnap.data() || {};
      const state = normalizePromoState(pdata.state);

      if (state === "locked") {
        const ownerId = await findActiveOwnerAffiliateId(db, promoEntered);
        if (!ownerId) {
          attributionReason = "locked_promo_no_owner";
        } else {
          const ownerProf = await db
              .collection(AFFILIATE_PROFILES)
              .doc(ownerId)
              .get();
          if (isEffectivelyInactive(ownerProf)) {
            attributionReason = "locked_promo_owner_paused";
          } else if (!utmAffiliateId) {
            chainLeafId = ownerId;
            attributionStatus = "attributed";
            attributionReason = "locked_promo_owner";
          } else if (!affiliateInOwnerTree(utmAffSnap, ownerId)) {
            attributionReason = "locked_promo_utm_outside_tree";
          } else {
            chainLeafId = utmAffiliateId;
            attributionStatus = "attributed";
            attributionReason = "locked_promo_owner";
          }
        }
      } else {
        if (!utmAffiliateId) {
          attributionReason = "shared_promo_requires_valid_utm";
        } else {
          const active = await isPromoAssignmentActive(
              db,
              promoEntered,
              utmAffiliateId,
          );
          if (!active) {
            attributionReason = "shared_promo_affiliate_not_assigned";
          } else {
            chainLeafId = utmAffiliateId;
            attributionStatus = "attributed";
            attributionReason = "shared_promo_with_assignment_and_utm";
          }
        }
      }
    }
  } else if (allowNoPromoUtm && utmAffiliateId) {
    chainLeafId = utmAffiliateId;
    attributionStatus = "attributed";
    attributionReason = "no_promo_policy_utm_allowed";
  } else {
    attributionReason = allowNoPromoUtm ?
      "no_promo_no_valid_utm" :
      "no_promo_default_unattributed";
  }

  /** @type {Record<string, unknown>[]} */
  let chain = [];
  let anchorAffiliateId = /** @type {string | null} */ (null);
  let rootSuperAffiliateId = /** @type {string | null} */ (null);
  let totalChainCommissionCents = 0;
  let affiliateIdResolved = /** @type {string | null} */ (null);
  let commissionEligible = false;
  let commissionRateSnapshot = /** @type {number | null} */ (null);
  let commissionTypeSnapshot = /** @type {string | null} */ (null);
  let commissionFixedCentsSnapshot = /** @type {number | null} */ (null);

  if (chainLeafId) {
    const chainResult = await buildChainEntries(
        db,
        chainLeafId,
        originalAmountCents,
    );
    if (!chainResult.chain) {
      attributionStatus = "unattributed";
      attributionReason = chainResult.reason || "resolved_affiliate_paused_or_missing";
      chain = [];
      anchorAffiliateId = null;
      rootSuperAffiliateId = null;
      totalChainCommissionCents = 0;
    } else {
      chain = chainResult.chain;
      anchorAffiliateId = chainResult.anchorAffiliateId;
      rootSuperAffiliateId = chainResult.rootSuperAffiliateId;
      totalChainCommissionCents = chainResult.totalChainCommissionCents;
      attributionStatus = "attributed";
      affiliateIdResolved = anchorAffiliateId;
      commissionEligible = true;
      const superEntry = chain[chain.length - 1];
      if (superEntry && typeof superEntry === "object") {
        const se = /** @type {Record<string, unknown>} */ (superEntry);
        commissionRateSnapshot =
          typeof se.commissionRateSnapshot === "number" ?
            se.commissionRateSnapshot :
            null;
        commissionTypeSnapshot =
          typeof se.commissionType === "string" ? se.commissionType : null;
        const rawFixed = se.commissionFixedCentsSnapshot;
        commissionFixedCentsSnapshot =
          typeof rawFixed === "number" && Number.isFinite(rawFixed) ?
            Math.round(rawFixed) :
            null;
      }
    }
  }

  return {
    attribution: {
      rawUtm: {
        source: rawUtmOut.source || null,
        medium: rawUtmOut.medium || null,
        campaign: rawUtmOut.campaign || null,
      },
      utmSnapshot: {
        capturedAtMs:
          parsed.capturedAtMs === undefined ? null : parsed.capturedAtMs,
        clientWindowSeconds: 30 * 60,
        utmResolutionNote,
      },
      promoCodeEntered: promoEntered || null,
      anchorAffiliateId,
      rootSuperAffiliateId,
      chain,
      totalChainCommissionCents,
      affiliateIdResolved,
      attributionStatus,
      attributionReason,
      commissionEligible,
      commissionRateSnapshot,
      commissionTypeSnapshot,
      commissionFixedCentsSnapshot,
    },
  };
}

module.exports = {resolveCheckoutAttribution};

/* eslint-enable valid-jsdoc, max-len, require-jsdoc */
