/* eslint-disable valid-jsdoc, max-len, require-jsdoc */
/**
 * Public funnel ingest (first-party landing → Firestore).
 * humn-health schema; no `peptide_plus_view` event type.
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {FieldValue, Timestamp} = require("firebase-admin/firestore");
const {db} = require("../utils/Firebase.js");
const {sendJson} = require("../utils/httpJson.js");

const FUNNEL_SESSIONS = "FunnelSessions";
const BUCKET_MS = 5 * 60 * 1000;
const MAX_EVENTS_PER_BUCKET = 60;
const MAX_PAYLOAD_BYTES = 4096;
const TS_SKEW_MS = 5 * 60 * 1000;

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_TYPES = new Set([
  "landing_view",
  "product_list_view",
  "product_view",
  "checkout_started",
  "checkout_step_completed",
  "order_button_clicked",
  "order_placed",
]);

/**
 * @param {unknown} id
 * @returns {id is string}
 */
function isUuidV4(id) {
  return typeof id === "string" && UUID_V4_RE.test(id.trim());
}

/**
 * @param {unknown} body
 * @returns {Record<string, unknown>}
 */
function asObject(body) {
  return body && typeof body === "object" && !Array.isArray(body) ? /** @type {Record<string, unknown>} */ (body) : {};
}

/**
 * @param {unknown} v
 * @returns {boolean}
 */
function fieldUnset(v) {
  return v == null || v === undefined;
}

/**
 * @param {FirebaseFirestore.DocumentData} data
 * @param {string} type
 * @param {Record<string, unknown>} payload
 * @param {string} path
 * @param {FirebaseFirestore.Timestamp} clientTs
 * @param {Record<string, unknown> | null} context
 * @returns {Record<string, unknown>}
 */
function buildSessionPatch(data, type, payload, path, clientTs, context) {
  /** @type {Record<string, unknown>} */
  const patch = {
    lastActivityAt: FieldValue.serverTimestamp(),
    lastPath: path || "",
  };

  const seq = Array.isArray(data.orderedSequence) ?
    data.orderedSequence.map((x) => String(x || "")).filter(Boolean) :
    [];
  seq.push(type);
  while (seq.length > 50) seq.shift();
  patch.orderedSequence = seq;

  if (context && typeof context === "object" && !data.contextApplied) {
    const utm = /** @type {Record<string, unknown>} */ (context).utm;
    if (utm && typeof utm === "object") {
      const u = /** @type {Record<string, unknown>} */ (utm);
      patch.utmSource = typeof u.source === "string" ? u.source : "";
      patch.utmMedium = typeof u.medium === "string" ? u.medium : "";
      patch.utmCampaign = typeof u.campaign === "string" ? u.campaign : "";
    }
    if (typeof context.landingPath === "string" && context.landingPath.trim()) {
      patch.landingPath = context.landingPath.trim();
    }
    if (typeof context.referrer === "string") patch.referrer = context.referrer.slice(0, 2048);
    if (typeof context.deviceClass === "string") {
      const dc = context.deviceClass;
      if (dc === "mobile" || dc === "tablet" || dc === "desktop") patch.deviceClass = dc;
    }
    patch.contextApplied = true;
  }

  if (type === "landing_view" && typeof path === "string" && path.trim()) {
    if (!data.landingPath) patch.landingPath = path.trim();
  }

  if (type === "product_view") {
    patch.productViews = FieldValue.increment(1);
    const pid = typeof payload.clientProductId === "string" ? payload.clientProductId.trim() : "";
    if (pid) patch.lastProductId = pid;
  }

  if (type === "checkout_started") {
    if (fieldUnset(data.enteredCheckoutAt)) patch.enteredCheckoutAt = clientTs;
    const cp = typeof payload.clientProductId === "string" ? payload.clientProductId.trim() : "";
    if (cp) patch.clientProductId = cp;
  }

  if (type === "checkout_step_completed") {
    const step = typeof payload.step === "number" && Number.isFinite(payload.step) ? Math.round(payload.step) : 0;
    if (step === 1 && fieldUnset(data.step1At)) patch.step1At = clientTs;
    if (step === 2 && fieldUnset(data.step2At)) patch.step2At = clientTs;
    if (step === 3 && fieldUnset(data.step3At)) patch.step3At = clientTs;
    if (step === 4 && fieldUnset(data.step4At)) patch.step4At = clientTs;
    const prevMax = typeof data.maxStepCompleted === "number" && Number.isFinite(data.maxStepCompleted) ?
      data.maxStepCompleted :
      0;
    if (step >= 1 && step <= 4) {
      const next = Math.max(prevMax, step);
      if (next > prevMax) patch.maxStepCompleted = next;
    }
  }

  if (type === "order_button_clicked" && fieldUnset(data.orderClickedAt)) {
    patch.orderClickedAt = clientTs;
  }

  if (type === "order_placed") {
    if (fieldUnset(data.orderPlacedAt)) patch.orderPlacedAt = clientTs;
    const pi = typeof payload.paymentIntentId === "string" ? payload.paymentIntentId.trim() : "";
    const cs = typeof payload.checkoutSessionId === "string" ? payload.checkoutSessionId.trim() : "";
    const oid = typeof payload.orderId === "string" ? payload.orderId.trim() : "";
    const cp = typeof payload.clientProductId === "string" ? payload.clientProductId.trim() : "";
    if (pi) patch.paymentIntentId = pi;
    if (cs) patch.checkoutSessionId = cs;
    if (oid) patch.orderId = oid;
    if (cp) patch.clientProductId = cp;
    patch.abandoned = false;
  }

  return patch;
}

/**
 * @param {FirebaseFirestore.Transaction} tx
 * @param {FirebaseFirestore.DocumentReference} sessionRef
 * @param {string} sessionId
 * @param {string} type
 * @param {Record<string, unknown>} payload
 * @param {string} path
 * @param {number} clientTsMs
 * @param {Record<string, unknown> | null} context
 */
async function applyEventInTransaction(tx, sessionRef, sessionId, type, payload, path, clientTsMs, context) {
  const snap = await tx.get(sessionRef);
  const nowMs = Date.now();
  const data = snap.exists ? snap.data() || {} : {};

  const lastBucketAtMs =
    data.lastBucketAt && typeof data.lastBucketAt.toMillis === "function" ? data.lastBucketAt.toMillis() : 0;
  let count = typeof data.recentEventCount === "number" && Number.isFinite(data.recentEventCount) ?
    data.recentEventCount :
    0;
  const bucketReset = !lastBucketAtMs || nowMs - lastBucketAtMs >= BUCKET_MS;
  if (bucketReset) {
    count = 0;
  }
  if (count >= MAX_EVENTS_PER_BUCKET) {
    const err = new Error("rate_limited");
    err.code = "rate_limited";
    throw err;
  }

  const clientTs = Timestamp.fromMillis(clientTsMs);

  /** @type {Record<string, unknown>} */
  const initial = {};
  if (!snap.exists) {
    initial.createdAt = FieldValue.serverTimestamp();
    initial.orderPlacedAt = null;
    initial.abandoned = false;
    initial.maxStepCompleted = 0;
    initial.productViews = 0;
    initial.viewedPeptidePlus = false;
    initial.reminderEligibleAt = null;
    initial.reminderSentAt = null;
    initial.reminderState = "none";
    initial.reminderAttempts = 0;
    initial.reminderLastAttemptAt = null;
    initial.reminderSendingAt = null;
    initial.reminderError = null;
    initial.email = null;
    initial.checkoutSessionId = null;
    initial.clientProductId = null;
    initial.lastProductId = null;
    initial.orderedSequence = [];
    initial.contextApplied = false;
  }

  const patch = buildSessionPatch(
      snap.exists ? data : {},
      type,
      payload,
      path,
      clientTs,
      snap.exists && data.contextApplied ? null : context,
  );

  const evRef = sessionRef.collection("events").doc();
  tx.set(evRef, {
    type,
    ts: clientTs,
    path: path || "",
    payload: payload || {},
  });

  tx.set(
      sessionRef,
      {
        ...initial,
        ...patch,
        recentEventCount: count + 1,
        lastBucketAt: Timestamp.fromMillis(bucketReset ? nowMs : lastBucketAtMs),
      },
      {merge: true},
  );
}

async function handleEvent(req, res) {
  const body = asObject(req.body);
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";
  const ts = typeof body.ts === "number" && Number.isFinite(body.ts) ? body.ts : 0;
  const path = typeof body.path === "string" ? body.path.slice(0, 2048) : "";
  const payload = asObject(body.payload);
  const context = body.context && typeof body.context === "object" ?
    /** @type {Record<string, unknown>} */ (body.context) :
    null;

  if (!isUuidV4(sessionId)) {
    sendJson(res, 400, {success: false, error: "sessionId must be a UUID v4"});
    return;
  }
  if (!ALLOWED_TYPES.has(type)) {
    sendJson(res, 400, {success: false, error: "invalid type"});
    return;
  }
  const now = Date.now();
  if (!ts || Math.abs(now - ts) > TS_SKEW_MS) {
    sendJson(res, 400, {success: false, error: "ts out of range"});
    return;
  }

  let payloadBytes = 0;
  try {
    payloadBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  } catch {
    payloadBytes = MAX_PAYLOAD_BYTES + 1;
  }
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    sendJson(res, 400, {success: false, error: "payload too large"});
    return;
  }

  if (type === "checkout_step_completed") {
    const step = payload.step;
    if (typeof step !== "number" || !Number.isFinite(step) || step < 1 || step > 4) {
      sendJson(res, 400, {success: false, error: "checkout_step_completed requires payload.step 1..4"});
      return;
    }
  }

  const sessionRef = db.collection(FUNNEL_SESSIONS).doc(sessionId);
  try {
    await db.runTransaction((tx) =>
      applyEventInTransaction(tx, sessionRef, sessionId, type, payload, path, ts, context),
    );
  } catch (e) {
    if (e && typeof e === "object" && /** @type {{code?: string}} */ (e).code === "rate_limited") {
      sendJson(res, 429, {success: false, error: "Too many events for this session."});
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("funnelHttp: event transaction failed", {sessionId, type, error: msg});
    sendJson(res, 500, {success: false, error: "Internal error"});
    return;
  }

  sendJson(res, 200, {success: true});
}

async function handleLink(req, res) {
  const body = asObject(req.body);
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const checkoutSessionId =
    typeof body.checkoutSessionId === "string" && body.checkoutSessionId.trim() ?
      body.checkoutSessionId.trim() :
      "";
  const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!isUuidV4(sessionId)) {
    sendJson(res, 400, {success: false, error: "sessionId must be a UUID v4"});
    return;
  }
  if (!checkoutSessionId && !emailRaw) {
    sendJson(res, 400, {success: false, error: "checkoutSessionId and/or email required"});
    return;
  }
  if (emailRaw.length > 320) {
    sendJson(res, 400, {success: false, error: "email too long"});
    return;
  }

  const sessionRef = db.collection(FUNNEL_SESSIONS).doc(sessionId);
  let snap;
  try {
    snap = await sessionRef.get();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("funnelHttp: link read failed", {sessionId, error: msg});
    sendJson(res, 500, {success: false, error: "Internal error"});
    return;
  }
  const data = snap.exists ? snap.data() || {} : {};
  /** @type {Record<string, unknown>} */
  const patch = {lastActivityAt: FieldValue.serverTimestamp()};
  if (checkoutSessionId) patch.checkoutSessionId = checkoutSessionId;
  if (emailRaw) patch.email = emailRaw;

  // If the mark job abandoned the session before email existed, no reminder was
  // queued. When /link first supplies email, make the session eligible so the
  // reminder scheduler can send.
  if (emailRaw) {
    const abandoned = data.abandoned === true;
    const hasOrder = data.orderPlacedAt != null;
    const sent = data.reminderSentAt != null;
    const eligibleUnset = data.reminderEligibleAt == null;
    if (abandoned && !hasOrder && !sent && eligibleUnset) {
      patch.reminderEligibleAt = FieldValue.serverTimestamp();
      patch.reminderState = "eligible";
    }
  }

  try {
    await sessionRef.set(patch, {merge: true});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("funnelHttp: link failed", {sessionId, error: msg});
    sendJson(res, 500, {success: false, error: "Internal error"});
    return;
  }

  sendJson(res, 200, {success: true});
}

async function funnelHttpHandler(req, res) {
  const path = (req.path || "/").replace(/\/+$/, "");
  if (path.endsWith("/event")) {
    if (req.method !== "POST") {
      sendJson(res, 405, {success: false, error: "Method not allowed"});
      return;
    }
    await handleEvent(req, res);
    return;
  }
  if (path.endsWith("/link")) {
    if (req.method !== "POST") {
      sendJson(res, 405, {success: false, error: "Method not allowed"});
      return;
    }
    await handleLink(req, res);
    return;
  }
  sendJson(res, 404, {success: false, error: "Not found"});
}

exports.funnelHttp = onRequest(
    {
      region: "us-central1",
      cors: true,
      invoker: "public",
      memory: "256MiB",
      maxInstances: 10,
    },
    funnelHttpHandler,
);

/* eslint-enable valid-jsdoc, max-len, require-jsdoc */
