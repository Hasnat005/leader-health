/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

/**
 * Denormalized read model writer: AffiliateProfiles/{uid}/Orders/{orderId} (ADR-003).
 *
 * v2: one projection doc per chain tier (doc 21). Commission cents come from the
 * resolver chain (commissionNetCents), not re-derived here.
 *
 * Invariants (never break these):
 *   1. Skip when attribution.chain is empty — no affiliate-side docs written.
 *   2. Doc id === orderId (same as CheckoutOrders auto-id).
 *   3. merge:true is mandatory — payout pipeline writes commissionPaid* later.
 */

/**
 * @param {Record<string, unknown>[]} chain anchor-first (Micro → Super)
 * @param {number} index
 * @return {Record<string, unknown>[]}
 */
function buildDescendantBreakdown(chain, index) {
  const entry = chain[index];
  if (!entry || typeof entry !== "object") return [];
  const tier = String(entry.tier || "").trim().toLowerCase();
  if (tier === "micro") return [];
  if (index === 0) return [];
  const child = chain[index - 1];
  if (!child || typeof child !== "object") return [];
  const c = /** @type {Record<string, unknown>} */ (child);
  const affiliateId = String(c.affiliateId || "").trim();
  if (!affiliateId) return [];
  return [
    {
      affiliateId,
      tier: String(c.tier || "").trim().toLowerCase(),
      utmSlug: String(c.utmSlug || "").trim(),
      commissionGrossCents:
        typeof c.commissionGrossCents === "number" &&
        Number.isFinite(c.commissionGrossCents) ?
          Math.round(c.commissionGrossCents) :
          0,
    },
  ];
}

/**
 * @param {*} db Firestore (Admin SDK)
 * @param {{ orderId: string, orderData: Record<string, unknown> }} input
 * @return {Promise<void>}
 */
async function writeAffiliateOrderProjection(db, input) {
  const {orderId, orderData} = input;
  const attr =
    orderData.attribution && typeof orderData.attribution === "object" ?
      /** @type {Record<string, unknown>} */ (orderData.attribution) :
      null;
  const chain = Array.isArray(attr?.chain) ? attr.chain : [];
  if (chain.length === 0) return;

  const patient =
    orderData.patient && typeof orderData.patient === "object" ?
      /** @type {Record<string, unknown>} */ (orderData.patient) :
      {};

  const originalAmountCents =
    typeof orderData.originalAmountCents === "number" ?
      orderData.originalAmountCents :
      orderData.amountCents;
  const discountCents =
    typeof orderData.discountCents === "number" ? orderData.discountCents : 0;

  const productAmountCents =
    typeof orderData.productAmountCents === "number" &&
    Number.isFinite(orderData.productAmountCents) ?
      Math.round(orderData.productAmountCents) :
      originalAmountCents;

  const shared = {
    orderId,
    createdAt: orderData.createdAt || null,
    originalAmountCents,
    discountCents,
    amountCents: productAmountCents,
    currency: orderData.currency,
    promoCodeEntered: attr.promoCodeEntered ?
      String(attr.promoCodeEntered) :
      null,
    attributionStatus:
      typeof attr.attributionStatus === "string" ?
        attr.attributionStatus :
        "",
    attributionReason:
      typeof attr.attributionReason === "string" ?
        attr.attributionReason :
        "",
    customerEmail:
      typeof patient.email === "string" ? patient.email : "",
    customerName: `${
      typeof patient.firstName === "string" ? patient.firstName : ""
    } ${
      typeof patient.lastName === "string" ? patient.lastName : ""
    }`.trim() || "—",
    commissionEligible: true,
  };

  await Promise.all(
      chain.map((rawEntry, index) => {
        const entry =
          rawEntry && typeof rawEntry === "object" ?
            /** @type {Record<string, unknown>} */ (rawEntry) :
            {};
        const affiliateId = String(entry.affiliateId || "").trim();
        if (!affiliateId) {
          return Promise.resolve();
        }

        const commissionNetCents =
          typeof entry.commissionNetCents === "number" &&
          Number.isFinite(entry.commissionNetCents) ?
            Math.round(entry.commissionNetCents) :
            0;

        const projection = {
          ...shared,
          tier: String(entry.tier || "").trim().toLowerCase(),
          commissionType:
            typeof entry.commissionType === "string" ?
              entry.commissionType.trim().toLowerCase() :
              "percentage",
          commissionRateSnapshot:
            typeof entry.commissionRateSnapshot === "number" &&
            Number.isFinite(entry.commissionRateSnapshot) ?
              entry.commissionRateSnapshot :
              null,
          commissionFixedCentsSnapshot:
            typeof entry.commissionFixedCentsSnapshot === "number" &&
            Number.isFinite(entry.commissionFixedCentsSnapshot) ?
              Math.round(entry.commissionFixedCentsSnapshot) :
              null,
          commissionBaseCents:
            typeof entry.commissionBaseCents === "number" &&
            Number.isFinite(entry.commissionBaseCents) ?
              Math.round(entry.commissionBaseCents) :
              0,
          commissionGrossCents:
            typeof entry.commissionGrossCents === "number" &&
            Number.isFinite(entry.commissionGrossCents) ?
              Math.round(entry.commissionGrossCents) :
              0,
          commissionCents: commissionNetCents,
          descendantBreakdown: buildDescendantBreakdown(chain, index),
        };

        return db
            .collection("AffiliateProfiles")
            .doc(affiliateId)
            .collection("Orders")
            .doc(orderId)
            .set(projection, {merge: true});
      }),
  );
}

module.exports = {writeAffiliateOrderProjection, buildDescendantBreakdown};

/* eslint-enable valid-jsdoc, max-len, require-jsdoc */
