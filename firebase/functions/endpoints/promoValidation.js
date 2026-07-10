/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

/**
 * Public HTTP promo validation.
 *
 * Route: POST /validate-promo
 *
 * Validates a promo code against Gen-Health (authoritative) in parallel with
 * the Firestore doc (local state, usageLimit, archived check). Returns pricing
 * from GH when available, with a Firestore-computed fallback.
 */

const logger = require("firebase-functions/logger");
const {db} = require("../utils/Firebase");
const {sendJson} = require("../utils/httpJson");
const {validatePromocodeOnGH} = require("../utils/genHealthApi");
const {
  parseClientAttributionSnapshot,
  normalizePromoCodeId,
  normalizeUtmSlug,
  promoAssignmentDocId,
} = require("../lib/promo/normalize");
const {
  AFFILIATE_PROFILES,
  PROMO_CODE_ASSIGNMENTS,
  findAffiliateProfileBySlug,
  isEffectivelyInactive,
  affiliateInOwnerTree,
  findActiveOwnerAffiliateId,
  isPromoAssignmentActive,
} = require("../lib/promo/affiliate");
const {
  normalizeFreeShipping,
} = require("../lib/promo/validatePromo");
const {buildGenHealthCart} = require("../lib/checkout/genHealth/cart.js");

const PROMO_CODES = "PromoCodes";
const CATALOG_PROVIDER_DOTFIT = "dotfit";

/**
 * v2 locked promo: owner = role owner; discount OK on owner slug, no UTM, or in-tree
 * assigned descendant (e.g. micro momen-lab-6 under super momen-lab-1).
 *
 * @param {*} db
 * @param {string} promoId
 * @param {string | null} owner Super owner uid
 * @param {boolean} ownerPaused
 * @param {string | null} lockedOwnerUtmSlug
 * @param {{ source?: string }} parsed
 * @param {*} utmProfile
 * @param {string | null} resolvedAffiliateId
 * @param {boolean} affiliatePackOk
 * @param {boolean} campaignMatchesPromo
 * @param {string[]} utmErrors
 * @return {Promise<{ applicable: boolean, attributionPossible: boolean }>}
 */
async function lockedPromoApplicability(
    db,
    promoId,
    owner,
    ownerPaused,
    lockedOwnerUtmSlug,
    parsed,
    utmProfile,
    resolvedAffiliateId,
    affiliatePackOk,
    campaignMatchesPromo,
    utmErrors,
) {
  if (!owner) {
    utmErrors.push("locked_promo_no_owner");
    return {applicable: false, attributionPossible: false};
  }
  if (ownerPaused) {
    utmErrors.push("locked_owner_paused");
    return {applicable: false, attributionPossible: false};
  }

  const slugMatchesOwner =
    affiliatePackOk &&
    lockedOwnerUtmSlug &&
    normalizeUtmSlug(parsed.source) === normalizeUtmSlug(lockedOwnerUtmSlug);

  let utmInTreeAssigned = false;
  if (affiliatePackOk && utmProfile && resolvedAffiliateId) {
    const inTree = affiliateInOwnerTree(utmProfile, owner);
    if (inTree) {
      utmInTreeAssigned = await isPromoAssignmentActive(
          db,
          promoId,
          resolvedAffiliateId,
      );
    }
    if (!slugMatchesOwner) {
      if (!inTree) {
        utmErrors.push("locked_promo_utm_outside_tree");
      } else if (!utmInTreeAssigned) {
        utmErrors.push("shared_promo_affiliate_not_assigned");
      }
    }
  }

  const lockedDiscountWithoutVisitorUtm = !affiliatePackOk;
  const applicable =
    campaignMatchesPromo &&
    utmErrors.length === 0 &&
    (lockedDiscountWithoutVisitorUtm || slugMatchesOwner || utmInTreeAssigned);

  return {applicable, attributionPossible: applicable};
}

/**
 * @param {*} db
 * @param {string} promoId
 * @return {Promise<{ owner: string | null, lockedOwnerUtmSlug: string | null, ownerPaused: boolean }>}
 */
async function resolveLockedPromoOwner(db, promoId) {
  const owner = await findActiveOwnerAffiliateId(db, promoId);
  let lockedOwnerUtmSlug = null;
  let ownerPaused = true;
  if (owner) {
    const prof = await db.collection(AFFILIATE_PROFILES).doc(owner).get();
    ownerPaused = isEffectivelyInactive(prof);
    lockedOwnerUtmSlug =
      prof.exists ? String(prof.data()?.utmSlug || "").trim() || null : null;
  }
  return {owner, lockedOwnerUtmSlug, ownerPaused};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param {unknown} ts Firestore Timestamp, ISO string, or ms number
 * @return {number | null}
 */
function timestampToMs(ts) {
  if (ts == null) return null;
  if (typeof ts === "number" && Number.isFinite(ts)) return ts;
  if (typeof ts === "string" && ts.trim()) {
    const t = Date.parse(ts);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof ts === "object") {
    const o = /** @type {{ toMillis?: () => number, toDate?: () => Date }} */ (ts);
    if (typeof o.toMillis === "function") return o.toMillis();
    if (typeof o.toDate === "function") return o.toDate().getTime();
  }
  return null;
}

function isPromoRedeemable(data) {
  if (data.archived === true) return false;
  if (data.status === "inactive") return false;

  const validity =
    data.validity && typeof data.validity === "object" ?
      /** @type {Record<string, unknown>} */ (data.validity) :
      null;
  const startsAtMs = validity ? timestampToMs(validity.startsAt) : null;
  if (startsAtMs != null && startsAtMs > Date.now()) return false;

  const exp = data.expiresAt;
  if (exp != null && typeof exp === "object") {
    const o = /** @type {{ toMillis?: () => number, toDate?: () => Date }} */ (exp);
    if (typeof o.toMillis === "function") {
      if (o.toMillis() < Date.now()) return false;
    } else if (typeof o.toDate === "function") {
      if (o.toDate().getTime() < Date.now()) return false;
    }
  }
  const endsAtMs = validity ? timestampToMs(validity.endsAt) : null;
  if (endsAtMs != null && endsAtMs < Date.now()) return false;

  const limit = data.usageLimit;
  const used =
    typeof data.usageCount === "number" && Number.isFinite(data.usageCount) ?
      data.usageCount : 0;
  if (limit != null && typeof limit === "number" && Number.isFinite(limit) && used >= limit) {
    return false;
  }
  return true;
}

/**
 * Extract cents from Gen-Health validation pricing block.
 * @param {unknown} pricing
 * @return {{ originalCents: number, finalCents: number } | null}
 */
function pricingFromGhValidation(pricing) {
  if (!pricing || typeof pricing !== "object") return null;
  const p = /** @type {Record<string, unknown>} */ (pricing);
  const lineTotal =
    p.lineTotal && typeof p.lineTotal === "object" ?
      /** @type {Record<string, unknown>} */ (p.lineTotal) : null;
  const lineSubtotal =
    p.lineSubtotal && typeof p.lineSubtotal === "object" ?
      /** @type {Record<string, unknown>} */ (p.lineSubtotal) : null;
  const finalRaw = lineTotal && lineTotal.amountCents;
  const originalRaw = lineSubtotal && lineSubtotal.amountCents;
  const finalCents =
    typeof finalRaw === "number" && Number.isFinite(finalRaw) ?
      Math.round(finalRaw) : null;
  const originalCents =
    typeof originalRaw === "number" && Number.isFinite(originalRaw) ?
      Math.round(originalRaw) : finalCents;
  if (finalCents == null || finalCents <= 0) return null;
  return {originalCents: originalCents ?? finalCents, finalCents};
}

function productScopeAllowsDiscount(data, clientProductId, categoryIds) {
  const appliesTo =
    data.appliesTo === "categories" ? "categories" :
      data.appliesTo === "products" ? "products" : "all";
  const pid = typeof clientProductId === "string" ? clientProductId.trim() : "";
  const cids = Array.isArray(categoryIds) ?
    categoryIds.map((x) => String(x || "").trim()).filter(Boolean) :
    typeof categoryIds === "string" && categoryIds.trim() ?
      [categoryIds.trim()] : [];
  if (appliesTo === "all") return true;
  if (appliesTo === "products") {
    const ids = Array.isArray(data.productIds) ?
      data.productIds.map((x) => String(x || "").trim()).filter(Boolean) : [];
    return Boolean(pid) && ids.includes(pid);
  }
  if (appliesTo === "categories") {
    const ids = Array.isArray(data.categoryIds) ?
      data.categoryIds.map((x) => String(x || "").trim()).filter(Boolean) : [];
    return cids.length > 0 && cids.some((c) => ids.includes(c));
  }
  return true;
}

function computeFinalPriceCents(baseCents, discountType, discountValue) {
  if (!Number.isFinite(baseCents) || baseCents <= 0) return baseCents;
  if (discountType === "set_price") {
    const setCents = Math.round(discountValue * 100);
    return Math.max(0, setCents);
  }
  const dt = discountType === "fixed" ? "fixed" : "percentage";
  const dv =
    typeof discountValue === "number" && Number.isFinite(discountValue) ?
      discountValue : 0;
  if (dv <= 0) return baseCents;
  if (dt === "percentage") {
    const pct = Math.min(100, Math.max(0, dv));
    return Math.max(1, Math.round(baseCents * (1 - pct / 100)));
  }
  return Math.max(1, baseCents - Math.round(dv * 100));
}

/**
 * Determine catalog provider from request or promo doc.
 * @param {object} input
 * @param {FirebaseFirestore.DocumentData|null} promoData
 * @return {string|null}
 */
function resolveCatalogProvider(input, promoData) {
  const fromInput = String(input.catalog_provider || "").trim().toLowerCase();
  if (fromInput === CATALOG_PROVIDER_DOTFIT) return CATALOG_PROVIDER_DOTFIT;
  if (promoData) {
    const fromDoc = String(promoData.catalog_provider || promoData.source || "").trim().toLowerCase();
    if (fromDoc === CATALOG_PROVIDER_DOTFIT || fromDoc === "dotfit") return CATALOG_PROVIDER_DOTFIT;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Core validate logic (Gen Health path)
// ---------------------------------------------------------------------------

async function runValidatePromo(input) {
  const tag = `[validatePromo][${typeof input.promoCode === "string" ? input.promoCode.toUpperCase() : "?"}]`;

  logger.info(`${tag} START`, {
    promoCode: input.promoCode,
    clientProductId: input.clientProductId,
    categoryIds: input.categoryIds,
    baseAmountCents: input.baseAmountCents,
    catalog_provider: input.catalog_provider,
    hasLines: Array.isArray(input.lines) && input.lines.length > 0,
    hasAttributionSnapshot: Boolean(input.attributionSnapshot),
  });

  const emptyUtm = () => ({
    errors: [],
    campaignMatchesPromo: true,
    present: false,
    affiliatePackOk: false,
    resolvedAffiliateId: null,
    source: null,
    medium: null,
    campaign: null,
  });

  const invalidResult = (promoId, ghReasonCodes = [], freeShipping = false) => ({
    promoValid: false,
    valid: false,
    applicable: false,
    attributionPossible: false,
    promoId: promoId || null,
    state: null,
    lockedOwnerAffiliateId: null,
    lockedOwnerUtmSlug: null,
    utm: emptyUtm(),
    pricing: null,
    freeShipping,
    ghReasonCodes,
  });

  const promoId = normalizePromoCodeId(
      typeof input.promoCode === "string" ? input.promoCode : "",
  );
  if (!promoId) {
    logger.warn(`${tag} rejected: empty promoId after normalization`);
    return invalidResult(null);
  }

  // First fetch Firestore doc to determine catalog_provider
  const snap = await db.collection(PROMO_CODES).doc(promoId).get();
  const promoData = snap.exists ? snap.data() || {} : null;
  const catalogProvider = resolveCatalogProvider(input, promoData);
  const isDotFit = catalogProvider === CATALOG_PROVIDER_DOTFIT;

  logger.info(`${tag} catalog provider resolved`, {
    catalogProvider,
    isDotFit,
    docExists: snap.exists,
  });

  // Leader Health: Dotfit promos not supported
  if (isDotFit) {
    logger.warn(`${tag} rejected: dotfit promos not supported`);
    return invalidResult(promoId, ["dotfit_not_supported"]);
  }

  // Gen Health path: call GH API in parallel (already have snap)
  const clientProductId =
    typeof input.clientProductId === "string" ? input.clientProductId.trim() : "";

  const ghResult = clientProductId ?
    await validatePromocodeOnGH(promoId, clientProductId) :
    {
      valid: false,
      reasonCodes: ["missing_client_product_id"],
      pricing: null,
      promocode: null,
    };

  if (!ghResult.valid) {
    logger.warn(`${tag} rejected: Gen-Health validation failed`, {
      reasonCodes: ghResult.reasonCodes,
    });
    return invalidResult(promoId, ghResult.reasonCodes);
  }

  const data = snap.exists ? snap.data() || {} : {};
  if (!snap.exists) {
    logger.warn(`${tag} promo doc missing in Firestore (GH valid)`, {promoId});
  } else {
    logger.info(`${tag} promo doc loaded`, {
      state: data.state,
      appliesTo: data.appliesTo,
      status: data.status,
      archived: data.archived,
      usageCount: data.usageCount,
      usageLimit: data.usageLimit,
    });
  }

  if (!snap.exists || !isPromoRedeemable(data)) {
    logger.warn(`${tag} rejected: Firestore redeemability check failed`);
    return invalidResult(promoId, ghResult.reasonCodes);
  }

  const rawState = typeof data.state === "string" ? data.state.trim().toLowerCase() : "";
  const state =
    rawState === "generic" ? "generic" :
      rawState === "shared" ? "shared" :
        "locked";

  const {owner, lockedOwnerUtmSlug, ownerPaused} = await resolveLockedPromoOwner(db, promoId);
  logger.info(`${tag} owner lookup`, {state, owner, ownerPaused, lockedOwnerUtmSlug});

  const parsed = parseClientAttributionSnapshot(input.attributionSnapshot);
  const hasSource = Boolean(String(parsed.source || "").trim());
  const hasMedium = Boolean(String(parsed.medium || "").trim());
  const hasCampaign = Boolean(String(parsed.campaign || "").trim());
  const present = hasSource || hasMedium || hasCampaign;
  const utmErrors = [];

  logger.info(`${tag} attribution parsed`, {
    source: parsed.source,
    medium: parsed.medium,
    campaign: parsed.campaign,
  });

  if (hasSource && !hasMedium) utmErrors.push("utm_medium_required_with_source");
  if (hasCampaign && !hasMedium) utmErrors.push("utm_medium_required_with_campaign");
  if (hasMedium && parsed.medium !== "affiliate") utmErrors.push("utm_medium_not_affiliate");
  if (parsed.medium === "affiliate" && !hasSource) utmErrors.push("utm_affiliate_requires_source");

  let utmProfile = null;
  let resolvedAffiliateId = null;
  if (parsed.medium === "affiliate" && hasSource) {
    utmProfile = await findAffiliateProfileBySlug(db, parsed.source);
    if (!utmProfile) {
      utmErrors.push("utm_source_not_found");
      logger.warn(`${tag} utm_source_not_found: no AffiliateProfile with utmSlug="${parsed.source}"`);
    } else if (isEffectivelyInactive(utmProfile)) {
      utmErrors.push("affiliate_paused");
      logger.warn(`${tag} affiliate_paused: profile for slug="${parsed.source}" is paused`);
    } else {
      resolvedAffiliateId = utmProfile.id;
      logger.info(`${tag} affiliate resolved`, {resolvedAffiliateId, slug: parsed.source});
    }
  }

  const campaignNorm = normalizePromoCodeId(parsed.campaign);
  const campaignMatchesPromo = !hasCampaign || campaignNorm === promoId;
  if (hasCampaign && !campaignMatchesPromo) utmErrors.push("utm_campaign_mismatch");

  const affiliatePackOk =
    parsed.medium === "affiliate" &&
    hasSource &&
    Boolean(utmProfile) &&
    !isEffectivelyInactive(/** @type {*} */ (utmProfile));

  logger.info(`${tag} UTM validation complete`, {affiliatePackOk, utmErrors});

  let applicable = false;
  let attributionPossible = false;

  if (state === "generic") {
    applicable = true;
    attributionPossible = false;
    logger.info(`${tag} generic promo — discount only, no attribution`);
  } else if (state === "locked") {
    const locked = await lockedPromoApplicability(
        db,
        promoId,
        owner,
        ownerPaused,
        lockedOwnerUtmSlug,
        parsed,
        utmProfile,
        resolvedAffiliateId,
        affiliatePackOk,
        campaignMatchesPromo,
        utmErrors,
    );
    applicable = locked.applicable;
    attributionPossible = locked.attributionPossible;
    logger.info(`${tag} locked applicable check`, {
      hasOwner: Boolean(owner),
      ownerPaused,
      campaignMatchesPromo,
      utmErrorsCount: utmErrors.length,
      applicable,
    });
  } else {
    // shared
    applicable = true;
    if (affiliatePackOk && campaignMatchesPromo && resolvedAffiliateId) {
      const assignSnap = await db
          .collection(PROMO_CODE_ASSIGNMENTS)
          .doc(promoAssignmentDocId(promoId, resolvedAffiliateId))
          .get();
      attributionPossible =
        assignSnap.exists &&
        assignSnap.data()?.active !== false &&
        utmErrors.length === 0;
    }
  }

  const discountCheckoutEligible =
    state === "generic" || state === "shared" || (state === "locked" && applicable);
  const baseCentsRaw = input.baseAmountCents;
  const baseCents =
    typeof baseCentsRaw === "number" && Number.isFinite(baseCentsRaw) ?
      Math.round(baseCentsRaw) : null;

  logger.info(`${tag} eligibility`, {
    discountCheckoutEligible,
    baseCents,
    applicable,
    attributionPossible,
  });

  let pricing = null;
  if (discountCheckoutEligible) {
    const ghPricing = pricingFromGhValidation(ghResult.pricing);
    if (ghPricing) {
      pricing = {
        originalCents: ghPricing.originalCents,
        finalCents: ghPricing.finalCents,
        discountAppliesToThisProduct: true,
        source: "gen_health",
      };
      logger.info(`${tag} pricing from Gen-Health`, pricing);
    } else if (baseCents != null && baseCents > 0) {
      const discountType = data.discountType === "fixed" ? "fixed" : "percentage";
      const discountValue =
        typeof data.discountValue === "number" && Number.isFinite(data.discountValue) ?
          data.discountValue : 0;
      const scopeOk = productScopeAllowsDiscount(
          data, input.clientProductId, input.categoryIds,
      );
      const finalCents = scopeOk && discountValue > 0 ?
        computeFinalPriceCents(baseCents, discountType, discountValue) :
        baseCents;
      pricing = {
        originalCents: baseCents,
        finalCents,
        discountType,
        discountValue,
        discountAppliesToThisProduct: scopeOk,
        source: "firestore_fallback",
      };
      logger.info(`${tag} pricing fallback (local)`, pricing);
    }
  }

  logger.info(`${tag} DONE`, {
    applicable,
    attributionPossible,
    hasPricing: pricing !== null,
  });

  const freeShipping = normalizeFreeShipping(data.freeShipping);

  return {
    promoValid: true,
    valid: true,
    applicable,
    attributionPossible,
    promoId,
    state,
    lockedOwnerAffiliateId: owner,
    lockedOwnerUtmSlug,
    utm: {
      errors: utmErrors,
      campaignMatchesPromo,
      present,
      affiliatePackOk,
      resolvedAffiliateId,
      source: hasSource ? String(parsed.source).trim() : null,
      medium: hasMedium ? String(parsed.medium).trim().toLowerCase() : null,
      campaign: hasCampaign ? String(parsed.campaign).trim() : null,
    },
    pricing,
    freeShipping,
    ghReasonCodes: [],
  };
}

// ---------------------------------------------------------------------------
// Multi-product Gen-Health cart validation
// ---------------------------------------------------------------------------

/**
 * Read the `products: [{ clientProductId }]` array the storefront sends.
 * @param {unknown} body
 * @return {string[]}
 */
function readClientProductIds(body) {
  const b = body && typeof body === "object" ?
    /** @type {Record<string, unknown>} */ (body) : {};
  const products = Array.isArray(b.products) ? b.products : [];
  return products
      .map((p) => {
        if (!p || typeof p !== "object") return "";
        const row = /** @type {Record<string, unknown>} */ (p);
        return typeof row.clientProductId === "string" ?
          row.clientProductId.trim() : "";
      })
      .filter(Boolean);
}

/**
 * Cart-build faults (bad/duplicate product id) are client errors, not 500s.
 * @param {unknown} err
 * @return {boolean}
 */
function isCartClientError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Product not found") ||
    msg.includes("not available") ||
    msg.includes("not eligible") ||
    msg.includes("no price") ||
    msg.includes("no valid price") ||
    msg.includes("At least one") ||
    msg.includes("Only one unit per product")
  );
}

/**
 * Server-authoritative multi-product promo validation.
 *
 * Validates EVERY cart product against the promo (via `buildGenHealthCart`, the
 * same builder the payment-intent/confirm path uses) so each eligible line is
 * discounted independently. For a locked promo the owner still earns commission
 * on the whole order value — that attribution happens at confirm-time; here we
 * only surface the discount plus the locked owner's utmSlug so the storefront
 * can stamp attribution.
 *
 * @param {string[]} clientProductIds
 * @param {string} promoCodeStr
 * @param {string} tag
 * @return {Promise<Record<string, unknown>>}
 */
async function validateGenHealthCart(clientProductIds, promoCodeStr, tag) {
  const emptyUtm = () => ({
    errors: [],
    campaignMatchesPromo: true,
    present: false,
    affiliatePackOk: false,
    resolvedAffiliateId: null,
    source: null,
    medium: null,
    campaign: null,
  });

  const invalidCart = (promoId, ghReasonCodes) => ({
    promoValid: false,
    valid: false,
    applicable: false,
    attributionPossible: false,
    promoId: promoId || null,
    state: null,
    lockedOwnerAffiliateId: null,
    lockedOwnerUtmSlug: null,
    lineItems: [],
    subtotalCents: 0,
    discountTotalCents: 0,
    totalCents: 0,
    utm: emptyUtm(),
    pricing: null,
    freeShipping: false,
    ghReasonCodes,
  });

  const promoId = normalizePromoCodeId(promoCodeStr);
  if (!promoId) return invalidCart(null, ["invalid_request"]);

  const snap = await db.collection(PROMO_CODES).doc(promoId).get();
  if (!snap.exists) return invalidCart(promoId, ["not_found_or_inactive"]);
  const promoData = snap.data() || {};
  if (!isPromoRedeemable(promoData)) {
    return invalidCart(promoId, ["promo_not_redeemable"]);
  }

  const cart = await buildGenHealthCart(clientProductIds, promoCodeStr);

  const rawState = typeof promoData.state === "string" ?
    promoData.state.trim().toLowerCase() : "";
  const state = rawState === "generic" ? "generic" :
    rawState === "shared" ? "shared" : "locked";
  const freeShipping = normalizeFreeShipping(promoData.freeShipping);
  const {owner, lockedOwnerUtmSlug} =
    await resolveLockedPromoOwner(db, promoId);

  const applicable = cart.promoAppliedToAny === true;

  logger.info(`${tag} GH cart validation DONE`, {
    state,
    productCount: cart.lineItems.length,
    subtotalCents: cart.subtotalCents,
    discountTotalCents: cart.discountTotalCents,
    totalCents: cart.totalCents,
    applicable,
  });

  // A valid, redeemable promo that discounts nothing in this cart is surfaced
  // as "does not apply to any product" so the shopper sees a clear message.
  if (!applicable) {
    return {
      ...invalidCart(promoId, ["not_applicable_to_any_product"]),
      state,
      lockedOwnerAffiliateId: owner,
      lockedOwnerUtmSlug,
      freeShipping,
      lineItems: cart.lineItems,
      subtotalCents: cart.subtotalCents,
      totalCents: cart.totalCents,
    };
  }

  return {
    promoValid: true,
    valid: true,
    applicable: true,
    attributionPossible: state === "locked",
    promoId,
    state,
    lockedOwnerAffiliateId: owner,
    lockedOwnerUtmSlug,
    lineItems: cart.lineItems,
    subtotalCents: cart.subtotalCents,
    discountTotalCents: cart.discountTotalCents,
    totalCents: cart.totalCents,
    utm: emptyUtm(),
    pricing: {
      originalCents: cart.subtotalCents,
      finalCents: cart.totalCents,
      discountCents: cart.discountTotalCents,
      discountAppliesToThisProduct: true,
      source: "gen_health_cart",
    },
    freeShipping,
    ghReasonCodes: [],
  };
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

async function handleValidatePromo(req, res) {
  const body = req.body || {};
  const promoCode = body.promoCode ?? body.promo ?? body.code ?? "";
  const promoCodeStr = typeof promoCode === "string" ? promoCode : "";
  const attributionSnapshot = body.attributionSnapshot ?? null;
  const baseAmountCents = body.baseAmountCents;
  const categoryIds = Array.isArray(body.categoryIds) ?
    body.categoryIds :
    typeof body.categoryId === "string" && body.categoryId.trim() ?
      [body.categoryId.trim()] : [];
  const catalogProvider = body.catalog_provider ?? null;
  const lines = Array.isArray(body.lines) ? body.lines : [];
  const clientProductIds = readClientProductIds(body);

  // Multi-product Gen-Health cart (storefront `products` payload). dotFIT carts
  // (which use `lines`) keep the legacy per-line path in runValidatePromo.
  const isDotfit =
    String(catalogProvider || "").trim().toLowerCase() === CATALOG_PROVIDER_DOTFIT;
  if (clientProductIds.length > 0 && lines.length === 0 && !isDotfit) {
    const tag = `[validatePromo][${promoCodeStr.toUpperCase() || "?"}]`;
    try {
      const result = await validateGenHealthCart(
          clientProductIds, promoCodeStr, tag,
      );
      sendJson(res, 200, {success: true, data: result});
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isCartClientError(err)) {
        sendJson(res, 400, {success: false, error: msg});
        return;
      }
      logger.error("promoValidationHttp: GH cart validate failed", {error: msg});
      sendJson(res, 500, {success: false, error: msg});
    }
    return;
  }

  // Legacy single-product / dotFIT path.
  const clientProductId =
    typeof body.clientProductId === "string" && body.clientProductId.trim() ?
      body.clientProductId.trim() :
      clientProductIds[0] || "";

  try {
    const result = await runValidatePromo({
      promoCode,
      attributionSnapshot,
      baseAmountCents,
      clientProductId,
      categoryIds,
      catalog_provider: catalogProvider,
      lines,
    });
    sendJson(res, 200, {success: true, data: result});
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("promoValidationHttp: validate-promo failed", {error: msg});
    sendJson(res, 500, {success: false, error: msg});
  }
}

async function promoValidationHttp(req, res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.set("Allow", "POST, OPTIONS");
    sendJson(res, 405, {success: false, error: "method_not_allowed"});
    return;
  }
  await handleValidatePromo(req, res);
}

module.exports = {promoValidationHttp};

/* eslint-enable valid-jsdoc, max-len, require-jsdoc */
