/**
 * Storefront promo validation (doc 05 §8). Read-only.
 */

const {Timestamp} = require("firebase-admin/firestore");

const {normalizePromoCodeId} = require("./normalize");
const {normalizeUtmSlug} = require("./utmNormalize");

const PROMO_CODES = "PromoCodes";
const PROMO_ASSIGNMENTS = "PromoCodeAssignments";
const AFFILIATE_PROFILES = "AffiliateProfiles";

/**
 * @param {*} raw
 * @return {'locked' | 'shared' | 'generic'}
 */
function normalizePromoState(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "generic") return "generic";
  if (s === "shared") return "shared";
  return "locked";
}

/**
 * @param {*} raw
 * @return {boolean}
 */
function normalizeFreeShipping(raw) {
  return raw === true;
}

/**
 * @param {FirebaseFirestore.DocumentData} data
 * @return {boolean}
 */
function isPromoRedeemable(data) {
  if (!data) {
    return false;
  }
  const now = Timestamp.now();
  if (data.expiresAt && data.expiresAt.toMillis &&
      data.expiresAt.toMillis() < now.toMillis()) {
    return false;
  }
  const limit = data.usageLimit;
  const count = typeof data.usageCount === "number" ? data.usageCount : 0;
  if (limit != null && typeof limit === "number" && count >= limit) {
    return false;
  }
  return true;
}

/**
 * @param {number} baseCents
 * @param {string} discountType
 * @param {number} discountValue
 * @return {number}
 */
function computeFinalPriceCents(baseCents, discountType, discountValue) {
  if (baseCents <= 0) {
    return baseCents;
  }
  if (discountType === "set_price") {
    const setCents = Math.round(discountValue * 100);
    return Math.max(0, setCents);
  }
  if (discountValue <= 0) {
    return baseCents;
  }
  if (discountType === "percentage") {
    const pct = Math.min(100, Math.max(0, discountValue));
    return Math.max(1, Math.round(baseCents * (1 - pct / 100)));
  }
  const offCents = Math.round(discountValue * 100);
  return Math.max(1, baseCents - offCents);
}

/**
 * Line-level discount for multi-product carts (dotFIT).
 * @param {object} promo Firestore promo doc
 * @param {object[]} lines Cart lines (part_number, quantity, unit_amount_cents)
 * @return {object} Discount breakdown for eligible lines
 */
function computeLineLevelDiscount(promo, lines) {
  const appliesTo = promo.appliesTo || "all";
  const promoProdIds = Array.isArray(promo.productIds) ?
    promo.productIds.map((x) => String(x || "").trim()).filter(Boolean) : [];
  const promoCatIds = Array.isArray(promo.categoryIds) ?
    promo.categoryIds.map((x) => String(x || "").trim()).filter(Boolean) : [];
  const discountType = promo.discountType || "percentage";
  const discountValue = typeof promo.discountValue === "number" ?
    promo.discountValue : Number(promo.discountValue || 0);

  const results = [];
  let eligibleCents = 0;
  let discountedCents = 0;
  let totalFinal = 0;

  for (const line of lines || []) {
    const partNum = String(line.part_number || "").trim();
    const qty =
      typeof line.quantity === "number" ? Math.max(1, line.quantity) : 1;
    const unitCents =
      typeof line.unit_amount_cents === "number" ?
        Math.round(line.unit_amount_cents) :
        0;
    const lineCents = unitCents * qty;
    const catSlug = String(line.categorySlug || "").trim();

    let eligible = false;
    if (appliesTo === "all") {
      eligible = true;
    } else if (appliesTo === "products") {
      eligible = partNum && promoProdIds.includes(partNum);
    } else if (appliesTo === "categories") {
      eligible = catSlug && promoCatIds.includes(catSlug);
    }

    if (eligible && lineCents > 0) {
      eligibleCents += lineCents;
      const finalLineCents =
        computeFinalPriceCents(lineCents, discountType, discountValue);
      discountedCents += (lineCents - finalLineCents);
      totalFinal += finalLineCents;
      results.push({
        part_number: partNum,
        originalCents: lineCents,
        finalCents: finalLineCents,
        discounted: true,
      });
    } else {
      totalFinal += lineCents;
      results.push({
        part_number: partNum,
        originalCents: lineCents,
        finalCents: lineCents,
        discounted: false,
      });
    }
  }

  return {
    eligibleCents,
    discountedCents,
    finalSubtotalCents: totalFinal,
    eligibleLines: results,
  };
}

/**
 * @param {FirebaseFirestore.DocumentData} promo
 * @param {string|undefined} clientProductId
 * @param {string[]} productCategoryIds
 * @return {boolean}
 */
function productScopeAllowsDiscount(
    promo, clientProductId, productCategoryIds) {
  const appliesTo = promo.appliesTo || "all";
  const cats = Array.isArray(promo.categoryIds) ? promo.categoryIds : [];
  const prods = Array.isArray(promo.productIds) ? promo.productIds : [];
  const pcids = Array.isArray(productCategoryIds) ? productCategoryIds : [];
  if (appliesTo === "all") {
    return true;
  }
  if (appliesTo === "products") {
    return Boolean(clientProductId && prods.includes(String(clientProductId)));
  }
  if (appliesTo === "categories") {
    return pcids.some((c) => cats.includes(c));
  }
  return false;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} slugNorm
 * @return {Promise<Object>}
 */
async function findAffiliateProfileBySlug(db, slugNorm) {
  if (!slugNorm) {
    return null;
  }
  const q = await db.collection(AFFILIATE_PROFILES)
      .where("utmSlug", "==", slugNorm)
      .limit(2)
      .get();
  if (q.empty) {
    return null;
  }
  const doc0 = q.docs[0];
  return {id: doc0.id, data: doc0.data() || {}};
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} promoId
 * @return {Promise<Object>}
 */
async function findLockedOwnerFromAssignments(db, promoId) {
  const q = await db.collection(PROMO_ASSIGNMENTS)
      .where("promoCodeId", "==", promoId)
      .where("active", "==", true)
      .get();
  if (q.empty) {
    return {ownerId: null, activeCount: 0};
  }
  const activeCount = q.size;
  if (activeCount !== 1) {
    return {ownerId: null, activeCount};
  }
  const firstData = q.docs[0].data() || {};
  const ownerId = firstData.affiliateId ?
    String(firstData.affiliateId) : null;
  return {ownerId, activeCount};
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {*} body
 * @return {Promise<Object>}
 */
async function validatePromo(db, body) {
  const base = {
    promoValid: false,
    valid: false,
    applicable: false,
    attributionPossible: false,
    promoId: null,
    state: null,
    lockedOwnerAffiliateId: null,
    lockedOwnerUtmSlug: null,
    utm: {
      errors: /** @type {string[]} */ ([]),
      campaignMatchesPromo: true,
      present: false,
      affiliatePackOk: false,
      resolvedAffiliateId: null,
      source: null,
      medium: null,
      campaign: null,
    },
    pricing: null,
  };

  let rawCode = "";
  if (body && typeof body === "object") {
    if (body.promoCode != null && String(body.promoCode).length) {
      rawCode = String(body.promoCode);
    } else if (body.code != null) {
      rawCode = String(body.code);
    }
  }
  const promoId = normalizePromoCodeId(
      typeof rawCode === "string" ? rawCode : String(rawCode || ""),
  );
  if (!promoId) {
    return base;
  }

  const promoSnap = await db.collection(PROMO_CODES).doc(promoId).get();
  if (!promoSnap.exists) {
    base.promoId = promoId;
    return base;
  }

  const promo = promoSnap.data() || {};
  const redeemable = isPromoRedeemable(promo);
  base.promoId = promoId;
  base.state = normalizePromoState(promo.state);

  if (!redeemable) {
    return base;
  }

  base.promoValid = true;
  base.valid = true;

  const {ownerId: lockedOwnerAffiliateId} =
    await findLockedOwnerFromAssignments(db, promoId);
  base.lockedOwnerAffiliateId = lockedOwnerAffiliateId;

  let lockedOwnerUtmSlug = null;
  let ownerPaused = false;
  if (lockedOwnerAffiliateId) {
    const prof = await db.collection(AFFILIATE_PROFILES)
        .doc(lockedOwnerAffiliateId).get();
    if (prof.exists) {
      const d = prof.data() || {};
      lockedOwnerUtmSlug = d.utmSlug != null ? String(d.utmSlug) : null;
      ownerPaused = d.paused === true;
    }
  }
  base.lockedOwnerUtmSlug = lockedOwnerUtmSlug ?
    normalizeUtmSlug(lockedOwnerUtmSlug) : null;

  const snap = body.attributionSnapshot || {};
  const rawUtm = snap.rawUtm || {};
  const sourceRaw = String(
      rawUtm.utmSource != null ? rawUtm.utmSource : rawUtm.source || "",
  ).trim();
  const mediumRaw = String(
      rawUtm.utmMedium != null ? rawUtm.utmMedium : rawUtm.medium || "",
  ).trim().toLowerCase();
  const campaignRaw = String(
      rawUtm.utmCampaign != null ? rawUtm.utmCampaign : rawUtm.campaign || "",
  ).trim();

  const sourceNorm = normalizeUtmSlug(sourceRaw);
  const campaignNorm = normalizePromoCodeId(campaignRaw);
  const campaignMatchesPromo = !campaignRaw || campaignNorm === promoId;

  base.utm.source = sourceNorm || null;
  base.utm.medium = mediumRaw || null;
  base.utm.campaign = campaignRaw || null;
  base.utm.present = Boolean(sourceRaw || mediumRaw || campaignRaw);
  base.utm.campaignMatchesPromo = campaignMatchesPromo;

  const utmErrors = base.utm.errors;
  if (sourceRaw && mediumRaw !== "affiliate") {
    utmErrors.push("utm_medium_not_affiliate_or_missing_source");
  }
  if (campaignRaw && !campaignMatchesPromo) {
    utmErrors.push("utm_campaign_mismatch");
  }

  let utmProfile = null;
  if (mediumRaw === "affiliate" && sourceNorm) {
    utmProfile = await findAffiliateProfileBySlug(db, sourceNorm);
  }
  const resolvedAffiliateId = utmProfile && utmProfile.data.paused !== true ?
    utmProfile.id : null;
  base.utm.resolvedAffiliateId = resolvedAffiliateId;
  base.utm.affiliatePackOk = Boolean(
      mediumRaw === "affiliate" && sourceNorm && utmProfile &&
      utmProfile.data.paused !== true,
  );

  const state = base.state;
  const owner = lockedOwnerAffiliateId;
  const slugMatchesOwner = Boolean(
      owner && sourceNorm && base.lockedOwnerUtmSlug &&
      base.lockedOwnerUtmSlug === sourceNorm,
  );

  if (state === "locked" && owner && base.lockedOwnerUtmSlug &&
      sourceNorm && !slugMatchesOwner) {
    utmErrors.push("locked_owner_utm_mismatch");
  }

  let applicable = false;
  let attributionPossible = false;

  if (state === "locked") {
    if (!owner) {
      applicable = true;
      attributionPossible = false;
    } else {
      applicable = Boolean(
          !ownerPaused && slugMatchesOwner && campaignMatchesPromo &&
          utmErrors.length === 0,
      );
      attributionPossible = applicable;
    }
  } else {
    applicable = true;
    let assignmentActive = false;
    if (resolvedAffiliateId) {
      const assignId = `${promoId}::${resolvedAffiliateId}`;
      const as = await db.collection(PROMO_ASSIGNMENTS).doc(assignId).get();
      const ad = as.data() || {};
      assignmentActive = as.exists && ad.active === true;
    }
    attributionPossible = Boolean(
        base.utm.affiliatePackOk && campaignMatchesPromo &&
        resolvedAffiliateId && assignmentActive && utmErrors.length === 0,
    );
  }

  base.applicable = applicable;
  base.attributionPossible = attributionPossible;

  const discountCheckoutEligible =
    state !== "locked" ||
    (state === "locked" && !owner) ||
    (state === "locked" && owner && applicable);
  const baseAmountCents = typeof body.baseAmountCents === "number" ?
    body.baseAmountCents : Number(body.baseAmountCents || 0);
  const clientProductId = body.clientProductId != null ?
    String(body.clientProductId) : "";
  let catIds = body.categoryIds;
  if (typeof catIds === "string") {
    catIds = catIds ? [catIds] : [];
  }
  if (!Array.isArray(catIds)) {
    catIds = [];
  }

  if (discountCheckoutEligible && baseAmountCents > 0) {
    const scopeOk = productScopeAllowsDiscount(
        promo, clientProductId, catIds.map(String),
    );
    const discountType =
        promo.discountType === "fixed" ? "fixed" : "percentage";
    const discountValue = typeof promo.discountValue === "number" ?
      promo.discountValue :
      Number(promo.discountValue || 0);
    const finalCents = scopeOk ?
      computeFinalPriceCents(baseAmountCents, discountType, discountValue) :
      baseAmountCents;
    base.pricing = {
      originalCents: baseAmountCents,
      finalCents: finalCents,
      discountType,
      discountValue,
      discountAppliesToThisProduct: scopeOk,
    };
  }

  return base;
}

module.exports = {
  validatePromo,
  normalizePromoCodeId,
  normalizePromoState,
  normalizeFreeShipping,
  isPromoRedeemable,
  computeFinalPriceCents,
  computeLineLevelDiscount,
  productScopeAllowsDiscount,
};
