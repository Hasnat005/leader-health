/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

/**
 * CheckoutOrders builder and writer (ADR-003 — immutable canonical ledger).
 *
 * Matches humn-health order shape for gen-health requestConsult integration.
 */

const CHECKOUT_ORDERS_COL = "CheckoutOrders";

/**
 * Builds the immutable CheckoutOrders document fields (multi-product).
 *
 * The order stores the full `lineItems[]` and `productIds[]`. For backward
 * compatibility with the dashboard + affiliate projection, the first line's
 * `clientProductId` and the cart totals are also mirrored onto the legacy
 * `clientProductId` / `amountCents` / `originalAmountCents` fields.
 *
 * @param {{
 *   sessionId: string,
 *   paymentIntentId: string,
 *   genHealthPatientIdUsed: string | null,
 *   genHealthPatientIdSource: string | null,
 *   lineItems: Array<Record<string, unknown>>,
 *   totalCents: number,
 *   subtotalCents: number,
 *   ghOrderIds?: string[],
 *   currency: string,
 *   customer: Record<string, unknown>,
 *   stripeStatus: string,
 *   useApiOrders: boolean,
 *   consultRes: { status: number },
 *   consultJson: Record<string, unknown>,
 *   attribution: Record<string, unknown>,
 *   genHealthMagicLink?: string | null,
 *   ghPatientStatus?: string | null,
 * }} input
 * @return {Record<string, unknown>}
 */
function buildOrderDoc(input) {
  const {
    sessionId,
    paymentIntentId,
    genHealthPatientIdUsed,
    genHealthPatientIdSource,
    lineItems,
    totalCents,
    subtotalCents,
    ghOrderIds,
    currency,
    customer,
    stripeStatus,
    useApiOrders,
    consultRes,
    consultJson,
    attribution,
    genHealthMagicLink,
    ghPatientStatus,
  } = input;

  const items = Array.isArray(lineItems) ? lineItems : [];
  const productIds = items
      .map((item) => (typeof item.clientProductId === "string" ? item.clientProductId.trim() : ""))
      .filter(Boolean);
  const firstId = productIds[0] || "";
  const totalC = typeof totalCents === "number" ? Math.round(totalCents) : 0;
  const subtotalC =
    typeof subtotalCents === "number" ? Math.round(subtotalCents) : totalC;
  const discountCents = subtotalC > totalC ? subtotalC - totalC : 0;
  const orderIds = Array.isArray(ghOrderIds) ? ghOrderIds.filter(Boolean) : [];

  const consultObj =
    consultJson && typeof consultJson === "object" ?
      /** @type {Record<string, unknown>} */ (consultJson) :
      /** @type {Record<string, unknown>} */ ({});

  return {
    sessionId,
    paymentIntentId,
    genHealthRequestConsultApiOrdersEnabled: useApiOrders,
    genHealthPatientIdUsed: genHealthPatientIdUsed || null,
    genHealthPatientIdSource,
    lineItems: items,
    productIds,
    ghOrderIds: orderIds,
    ghPrimaryOrderId: orderIds[0] ? String(orderIds[0]).trim() : null,
    totalCents: totalC,
    subtotalCents: subtotalC,
    // Legacy mirrors — dashboard + affiliate projection read these.
    clientProductId: firstId,
    amountCents: totalC,
    originalAmountCents: subtotalC,
    discountCents,
    currency: (currency || "usd").toLowerCase(),
    patient: {...customer},
    stripeStatus,
    requestConsultStatus:
      consultRes && typeof consultRes.status === "number" ?
        consultRes.status :
        0,
    requestConsultSuccess: consultObj.success === true,
    requestConsultData: consultObj.data || null,
    requestConsultError:
      consultObj.success === false ?
        (typeof consultObj.error === "string" ? consultObj.error : null) :
        null,
    createdAt: new Date().toISOString(),
    attribution,
    genHealthMagicLink: typeof genHealthMagicLink === "string" && genHealthMagicLink.trim() ?
      genHealthMagicLink.trim() : null,
    ghPatientStatus: typeof ghPatientStatus === "string" && ghPatientStatus.trim() ?
      ghPatientStatus.trim() : null,
  };
}

/**
 * @param {*} db Firestore
 * @param {Record<string, unknown>} orderDoc
 * @return {Promise<{ id: string }>}
 */
async function writeOrder(db, orderDoc) {
  return db.collection(CHECKOUT_ORDERS_COL).add(orderDoc);
}

module.exports = {CHECKOUT_ORDERS_COL, buildOrderDoc, writeOrder};

/* eslint-enable valid-jsdoc, max-len, require-jsdoc */
