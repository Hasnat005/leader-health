/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

/**
 * Multi-product Gen-Health cart builder.
 *
 * Ports the reference "Peptide Stacks" multi-product cart onto THIS project's
 * conventions:
 *   - `Products.pricing.amount` is stored as integer CENTS in this repo (the
 *     catalog sync converts dollars→cents), so we reuse `bootstrapGenHealthCheckout`
 *     which reads it as cents. (The reference stored dollars and multiplied ×100 —
 *     do NOT copy that math here.)
 *   - Gen-Health remains authoritative for promo pricing via `validatePromocodeOnGH`
 *     (same as the previous single-product flow), applied per eligible line.
 */

const {validatePromocodeOnGH} = require("../../../utils/genHealthApi.js");
const {normalizePromoCodeId} = require("../../promo/normalize.js");
const {bootstrapGenHealthCheckout} = require("./bootstrap.js");

/**
 * @typedef {{
 *   clientProductId: string,
 *   productName: string,
 *   listPriceCents: number,
 *   discountCents: number,
 *   finalPriceCents: number,
 *   promoApplied: boolean,
 * }} CartLineItem
 */

/**
 * Extract final price cents from a Gen-Health promo validation pricing block.
 *
 * @param {unknown} ghPricing
 * @return {number | null}
 */
function pricingCentsFromGhValidation(ghPricing) {
  if (!ghPricing || typeof ghPricing !== "object") return null;
  const p = /** @type {Record<string, unknown>} */ (ghPricing);
  const lineTotal =
    p.lineTotal && typeof p.lineTotal === "object" ?
      /** @type {Record<string, unknown>} */ (p.lineTotal) :
      null;
  const finalRaw = lineTotal && lineTotal.amountCents;
  if (typeof finalRaw === "number" && Number.isFinite(finalRaw) && finalRaw > 0) {
    return Math.round(finalRaw);
  }
  return null;
}

/**
 * One unit per product — carts may not contain duplicate lines.
 *
 * @param {string[]} clientProductIds
 */
function assertSingleUnitPerProduct(clientProductIds) {
  const seen = new Set();
  for (const raw of clientProductIds) {
    const id = String(raw || "").trim();
    if (!id) continue;
    if (seen.has(id)) {
      throw new Error(
          "Only one unit per product is allowed. Remove duplicate items from your cart.",
      );
    }
    seen.add(id);
  }
}

/**
 * @param {Array<Record<string, unknown>>} lineItems
 */
function assertSessionLineItemsSingleUnit(lineItems) {
  const ids = (Array.isArray(lineItems) ? lineItems : [])
      .map((item) => (typeof item.clientProductId === "string" ? item.clientProductId.trim() : ""))
      .filter(Boolean);
  assertSingleUnitPerProduct(ids);
}

/**
 * Gen-Health rejects a couponCode when the code does not apply to the order
 * products. Only forward a promo when the session cart actually discounted at
 * least one line.
 *
 * @param {Array<Record<string, unknown>>} lineItems
 * @param {string | null | undefined} promoCodeEntered
 * @param {string | null | undefined} promoCodeApplied
 * @return {string}
 */
function resolveCouponCodeForConsult(lineItems, promoCodeEntered, promoCodeApplied) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  const discountApplied = items.some((item) => {
    const discountCents =
      typeof item.discountCents === "number" && Number.isFinite(item.discountCents) ?
        Math.round(item.discountCents) :
        0;
    return item.promoApplied === true || discountCents > 0;
  });
  if (!discountApplied) return "";
  return normalizePromoCodeId(promoCodeEntered) || normalizePromoCodeId(promoCodeApplied);
}

/**
 * Server-authoritative multi-product cart with optional per-line promo.
 *
 * @param {string[]} clientProductIds
 * @param {string | null | undefined} promoCodeRaw
 * @return {Promise<{
 *   lineItems: CartLineItem[],
 *   subtotalCents: number,
 *   discountTotalCents: number,
 *   totalCents: number,
 *   promoCodeApplied: string,
 *   promoAppliedToAny: boolean,
 * }>}
 */
async function buildGenHealthCart(clientProductIds, promoCodeRaw) {
  const ids = (Array.isArray(clientProductIds) ? clientProductIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean);
  if (ids.length === 0) {
    throw new Error("At least one clientProductId is required");
  }
  assertSingleUnitPerProduct(ids);

  const promoId =
    typeof promoCodeRaw === "string" && promoCodeRaw.trim() ?
      normalizePromoCodeId(promoCodeRaw) :
      "";

  /** @type {CartLineItem[]} */
  const lineItems = [];
  for (const id of ids) {
    const boot = await bootstrapGenHealthCheckout(id);
    if (boot.errors.length > 0) {
      throw new Error(`${boot.errors[0]} (${id})`);
    }
    const listPriceCents = boot.amount_cents;
    let finalPriceCents = listPriceCents;
    let discountCents = 0;
    let promoApplied = false;

    if (promoId) {
      const ghPromo = await validatePromocodeOnGH(promoId, id);
      if (ghPromo.valid && ghPromo.pricing) {
        const finalCents = pricingCentsFromGhValidation(ghPromo.pricing);
        if (finalCents != null && finalCents < listPriceCents) {
          finalPriceCents = finalCents;
          discountCents = listPriceCents - finalCents;
          promoApplied = true;
        }
      }
    }

    lineItems.push({
      clientProductId: id,
      productName: boot.product_name || id,
      listPriceCents,
      discountCents,
      finalPriceCents,
      promoApplied,
    });
  }

  let subtotalCents = 0;
  let discountTotalCents = 0;
  let totalCents = 0;
  for (const item of lineItems) {
    subtotalCents += item.listPriceCents;
    discountTotalCents += item.discountCents;
    totalCents += item.finalPriceCents;
  }

  const promoAppliedToAny = lineItems.some((li) => li.promoApplied);

  return {
    lineItems,
    subtotalCents,
    discountTotalCents,
    totalCents,
    promoCodeApplied: promoAppliedToAny && promoId ? promoId : "",
    promoAppliedToAny,
  };
}

module.exports = {
  buildGenHealthCart,
  assertSingleUnitPerProduct,
  assertSessionLineItemsSingleUnit,
  resolveCouponCodeForConsult,
  pricingCentsFromGhValidation,
};

/* eslint-enable valid-jsdoc, max-len, require-jsdoc */
