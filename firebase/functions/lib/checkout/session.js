/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

/**
 * CheckoutSessions lifecycle helpers (ADR-003).
 *
 * State machine:
 *   STARTED → PAYMENT_INTENT_CREATED → PAYMENT_SUCCEEDED
 *           → CONSULT_REQUESTED → COMPLETED | FAILED
 *
 * After payment success we call gen-health requestConsult and record
 * CONSULT_REQUESTED. `recordFulfillmentRequest` remains for legacy tests only;
 * production checkout uses `recordConsultRequest`.
 *
 * Every write is a merge so the document accumulates fields across transitions.
 * `lastActivityAt` is bumped unconditionally — it is the watermark for ADR-004
 * abandoned-checkout detection.
 */

const CHECKOUT_SESSIONS_COL = "CheckoutSessions";

/** @enum {string} */
const SessionStatus = {
  STARTED: "started",
  PAYMENT_INTENT_CREATED: "payment_intent_created",
  PAYMENT_SUCCEEDED: "payment_succeeded",
  FULFILLMENT_REQUESTED: "fulfillment_requested",
  CONSULT_REQUESTED: "consult_requested",
  COMPLETED: "completed",
  FAILED: "failed",
};

/**
 * @return {string}
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {*} db
 * @param {string} sessionId
 * @param {Record<string, unknown>} patch
 */
async function patchSession(db, sessionId, patch) {
  const ref = db.collection(CHECKOUT_SESSIONS_COL).doc(sessionId);
  await ref.set(
      {
        ...patch,
        lastActivityAt: nowIso(),
      },
      {merge: true},
  );
}

/**
 * Creates a CheckoutSessions doc. Supports two shapes:
 *   - Multi-product (gen-health storefront): pass `lineItems` + `totalCents`
 *     + `subtotalCents` (and optional `shippingCents`, `promoCodeApplied`).
 *   - Single-product (dotFIT legacy): pass `clientProductId` + `amountCents`
 *     (+ optional `productName`).
 *
 * @param {*} db
 * @param {{
 *   lineItems?: Array<Record<string, unknown>>,
 *   totalCents?: number,
 *   subtotalCents?: number,
 *   shippingCents?: number,
 *   promoCodeApplied?: string | null,
 *   clientProductId?: string,
 *   amountCents?: number,
 *   productName?: string,
 *   currency: string,
 * }} input
 * @return {Promise<string>} sessionId
 */
async function createSession(db, input) {
  const ref = db.collection(CHECKOUT_SESSIONS_COL).doc();
  const createdAt = nowIso();
  const base = {
    status: SessionStatus.STARTED,
    currency: (input.currency || "usd").toLowerCase(),
    createdAt,
    lastActivityAt: createdAt,
  };

  if (Array.isArray(input.lineItems)) {
    const shippingCents =
      typeof input.shippingCents === "number" && Number.isFinite(input.shippingCents) ?
        Math.max(0, Math.round(input.shippingCents)) :
        0;
    await ref.set({
      ...base,
      lineItems: input.lineItems,
      totalCents: input.totalCents,
      subtotalCents: input.subtotalCents,
      shippingCents,
      promoCodeApplied:
        typeof input.promoCodeApplied === "string" ? input.promoCodeApplied : "",
    });
    return ref.id;
  }

  await ref.set({
    ...base,
    clientProductId: input.clientProductId,
    amountCents: input.amountCents,
    productName: typeof input.productName === "string" ? input.productName : "",
  });
  return ref.id;
}

/**
 * @param {*} db
 * @param {string} sessionId
 * @param {{ paymentIntentId: string }} input
 */
async function attachPaymentIntent(db, sessionId, input) {
  await patchSession(db, sessionId, {
    status: SessionStatus.PAYMENT_INTENT_CREATED,
    paymentIntentId: input.paymentIntentId,
  });
}

/**
 * @param {*} db
 * @param {string} sessionId
 * @param {{
 *   paymentIntentId: string,
 *   customer: Record<string, unknown>,
 *   promoCodeEntered?: string,
 *   attributionSnapshot?: unknown,
 * }} input
 */
async function recordPaymentSuccess(db, sessionId, input) {
  const patch = {
    status: SessionStatus.PAYMENT_SUCCEEDED,
    paymentIntentId: input.paymentIntentId,
    promoCodeEntered: input.promoCodeEntered || "",
    attributionSnapshot:
      input.attributionSnapshot === undefined ?
        null :
        input.attributionSnapshot,
    paymentSucceededAt: nowIso(),
  };
  if (input.customer != null && typeof input.customer === "object") {
    patch.customer = input.customer;
  }
  await patchSession(db, sessionId, patch);
}

/**
 * Records that a fulfillment action was attempted.
 *
 * @param {*} db
 * @param {string} sessionId
 * @param {{
 *   fulfillmentStatus: string,
 *   fulfillmentRef?: string | null,
 * }} input
 */
async function recordFulfillmentRequest(db, sessionId, input) {
  await patchSession(db, sessionId, {
    status: SessionStatus.FULFILLMENT_REQUESTED,
    fulfillmentStatus: input.fulfillmentStatus || "pending",
    fulfillmentRef: input.fulfillmentRef || null,
    fulfillmentRequestedAt: nowIso(),
  });
}

/**
 * After gen-health requestConsult (replaces fulfillment for telehealth flow).
 *
 * @param {*} db
 * @param {string} sessionId
 * @param {{
 *   genHealthPatientId: string,
 *   genHealthPatientIdSource: string | null,
 * }} input
 */
async function recordConsultRequest(db, sessionId, input) {
  await patchSession(db, sessionId, {
    status: SessionStatus.CONSULT_REQUESTED,
    genHealthPatientId: input.genHealthPatientId || null,
    genHealthPatientIdSource: input.genHealthPatientIdSource || null,
    consultRequestedAt: nowIso(),
  });
}

/**
 * @param {*} db
 * @param {string} sessionId
 * @param {{ orderId: string }} input
 */
async function completeSession(db, sessionId, input) {
  await patchSession(db, sessionId, {
    status: SessionStatus.COMPLETED,
    orderId: input.orderId,
    completedAt: nowIso(),
  });
}

/**
 * @param {*} db
 * @param {string} sessionId
 * @param {{ message: string, code?: string }} input
 */
async function markSessionFailed(db, sessionId, input) {
  await patchSession(db, sessionId, {
    status: SessionStatus.FAILED,
    failureMessage: input.message,
    failureCode: input.code || "unknown",
    failedAt: nowIso(),
  });
}

module.exports = {
  CHECKOUT_SESSIONS_COL,
  SessionStatus,
  createSession,
  attachPaymentIntent,
  recordPaymentSuccess,
  recordFulfillmentRequest,
  recordConsultRequest,
  completeSession,
  markSessionFailed,
};

/* eslint-enable valid-jsdoc, max-len, require-jsdoc */
