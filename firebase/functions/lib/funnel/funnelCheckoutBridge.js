/* eslint-disable valid-jsdoc, max-len, require-jsdoc */
const logger = require("firebase-functions/logger");
const {FieldValue} = require("firebase-admin/firestore");

const FUNNEL_SESSIONS = "FunnelSessions";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} id
 * @returns {id is string}
 */
function isUuidV4(id) {
  return typeof id === "string" && UUID_V4_RE.test(id.trim());
}

/**
 * @param {*} db
 * @param {unknown} funnelSessionId
 * @param {string} checkoutSessionId
 */
async function mergeFunnelCheckoutSessionId(db, funnelSessionId, checkoutSessionId) {
  if (!isUuidV4(funnelSessionId) || !checkoutSessionId || typeof checkoutSessionId !== "string") return;
  const sid = funnelSessionId.trim();
  const cs = checkoutSessionId.trim();
  if (!cs) return;
  try {
    await db.collection(FUNNEL_SESSIONS).doc(sid).set(
        {
          checkoutSessionId: cs,
          lastActivityAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
    );
    logger.info("funnelCheckoutBridge: checkoutSessionId linked", {funnelSessionId: sid, checkoutSessionId: cs});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("funnelCheckoutBridge: merge checkoutSessionId failed (non-fatal)", {error: msg, funnelSessionId: sid});
  }
}

/**
 * @param {*} db
 * @param {unknown} funnelSessionId
 * @param {{
 *   orderId: string,
 *   paymentIntentId: string,
 *   checkoutSessionId: string,
 * }} input
 */
async function mergeFunnelOrderPlaced(db, funnelSessionId, input) {
  if (!isUuidV4(funnelSessionId)) return;
  const sid = funnelSessionId.trim();
  try {
    await db.collection(FUNNEL_SESSIONS).doc(sid).set(
        {
          orderPlacedAt: FieldValue.serverTimestamp(),
          orderId: input.orderId,
          paymentIntentId: input.paymentIntentId,
          checkoutSessionId: input.checkoutSessionId,
          abandoned: false,
          lastActivityAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
    );
    logger.info("funnelCheckoutBridge: order placed merged into funnel session", {funnelSessionId: sid, orderId: input.orderId});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("funnelCheckoutBridge: merge order placed failed (non-fatal)", {error: msg, funnelSessionId: sid});
  }
}

module.exports = {mergeFunnelCheckoutSessionId, mergeFunnelOrderPlaced, isUuidV4};

/* eslint-enable valid-jsdoc, max-len, require-jsdoc */
