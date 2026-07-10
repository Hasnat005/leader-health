/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const admin = require("firebase-admin");
const {HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {db} = require("../../utils/Firebase.js");
const {patchPromocodeToGenHealth} = require("../../utils/genHealthApi.js");
const {
  CATALOG_PROVIDER_GEN_HEALTH,
  normalizeCatalogProvider,
} = require("../catalogProvider.js");

const PROMO_CODES_COLLECTION = "PromoCodes";
const PROMO_CODE_ASSIGNMENTS_COLLECTION = "PromoCodeAssignments";
const AFFILIATE_PROFILES_COLLECTION = "AffiliateProfiles";

/**
 * @param {unknown} raw
 * @return {'locked' | 'shared' | 'generic'}
 */
function readPromoState(raw) {
  if (raw === "shared") return "shared";
  if (raw === "locked") return "locked";
  if (raw === "generic") return "generic";
  return "generic";
}

/**
 * @param {unknown} ids
 * @return {string[]}
 */
function normalizeAssignedAffiliateIds(ids) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(ids) ? ids : []) {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * @param {unknown} raw
 * @param {"start" | "end"} boundary
 * @return {string | null}
 */
function toValidityIsoTimestamp(raw, boundary) {
  if (raw == null || raw === "") return null;

  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const parts = s.split("-").map((x) => Number.parseInt(x, 10));
      if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
      const [y, m, d] = parts;
      const ms = boundary === "end" ?
        Date.UTC(y, m - 1, d, 23, 59, 59, 999) :
        Date.UTC(y, m - 1, d, 0, 0, 0, 0);
      const dt = new Date(ms);
      return Number.isFinite(dt.getTime()) ? dt.toISOString() : null;
    }
    const parsed = Date.parse(s);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }

  if (raw instanceof Date) {
    return Number.isFinite(raw.getTime()) ? raw.toISOString() : null;
  }

  if (typeof raw === "object" && raw !== null) {
    const o = /** @type {{ toDate?: () => Date, toMillis?: () => number, _seconds?: number }} */ (raw);
    if (typeof o.toDate === "function") {
      const d = o.toDate();
      return d instanceof Date && Number.isFinite(d.getTime()) ? d.toISOString() : null;
    }
    if (typeof o.toMillis === "function") {
      const ms = o.toMillis();
      return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
    }
    if (typeof o._seconds === "number" && Number.isFinite(o._seconds)) {
      return new Date(o._seconds * 1000).toISOString();
    }
  }

  return null;
}

/**
 * @param {string | null} startsAtIso
 * @param {string | null} endsAtIso
 * @return {null | { startsAt: string, endsAt: string } | { endsAt: string }}
 */
function buildGhValidityPatch(startsAtIso, endsAtIso) {
  if (!endsAtIso) return null;
  if (startsAtIso) return {startsAt: startsAtIso, endsAt: endsAtIso};
  return {endsAt: endsAtIso};
}

/**
 * @param {string[]} affiliateIds
 * @return {Promise<Array<{ affiliateId: string, utmSlug: string }>>}
 */
async function buildGhAffiliates(affiliateIds) {
  /** @type {Array<{ affiliateId: string, utmSlug: string }>} */
  const affiliates = [];
  for (const affiliateId of affiliateIds) {
    const snap = await db.doc(`${AFFILIATE_PROFILES_COLLECTION}/${affiliateId}`).get();
    if (!snap.exists) {
      throw new HttpsError("invalid-argument", `Affiliate profile not found: ${affiliateId}`);
    }
    const utmSlug = String(snap.get("utmSlug") || "").trim();
    if (!utmSlug) {
      throw new HttpsError(
          "failed-precondition",
          "Each assigned affiliate must have a UTM slug configured before saving.",
      );
    }
    affiliates.push({affiliateId, utmSlug});
  }
  return affiliates;
}

/**
 * @param {string} code
 * @return {Promise<string[]>}
 */
async function listActiveAssigneeIdsForPromo(code) {
  const activeQ = await db.collection(PROMO_CODE_ASSIGNMENTS_COLLECTION)
      .where("promoCodeId", "==", code)
      .where("active", "==", true)
      .get();
  return normalizeAssignedAffiliateIds(
      activeQ.docs.map((d) => d.data().affiliateId),
  );
}

/**
 * v2: active owner-tier assignees only (Gen-Health mirror).
 * @param {string} code
 * @return {Promise<string[]>}
 */
async function listActiveOwnerAssigneeIdsForPromo(code) {
  const activeQ = await db.collection(PROMO_CODE_ASSIGNMENTS_COLLECTION)
      .where("promoCodeId", "==", code)
      .where("role", "==", "owner")
      .where("active", "==", true)
      .get();
  return normalizeAssignedAffiliateIds(
      activeQ.docs.map((d) => d.data().affiliateId),
  );
}

/**
 * @param {FirebaseFirestore.DocumentSnapshot} promoSnap
 * @return {null | { startsAt: string, endsAt: string } | { endsAt: string }}
 */
function ghValidityFromPromoSnap(promoSnap) {
  const prevValidity =
    promoSnap.get("validity") && typeof promoSnap.get("validity") === "object" ?
      /** @type {Record<string, unknown>} */ (promoSnap.get("validity")) :
      {};
  const startsAtIso = toValidityIsoTimestamp(prevValidity.startsAt, "start");
  const endsAtIso = toValidityIsoTimestamp(prevValidity.endsAt, "end");
  if (!endsAtIso && promoSnap.get("expiresAt")) {
    const fromExpires = toValidityIsoTimestamp(promoSnap.get("expiresAt"), "end");
    return buildGhValidityPatch(startsAtIso, fromExpires);
  }
  return buildGhValidityPatch(startsAtIso, endsAtIso);
}

/**
 * Re-PATCH Gen-Health from Firestore mirror (assignments + promo doc). No assignment reconcile.
 *
 * @param {string} code
 * @return {Promise<{ code: string, success?: boolean, skipped?: boolean, reason?: string }>}
 */
async function pushPromoMirrorToGenHealth(code) {
  const promoRef = db.collection(PROMO_CODES_COLLECTION).doc(code);
  const promoSnap = await promoRef.get();
  if (!promoSnap.exists) {
    return {code, skipped: true, reason: "not-found"};
  }
  if (promoSnap.get("archived") === true) {
    return {code, skipped: true, reason: "archived"};
  }

  const provider =
    normalizeCatalogProvider(promoSnap.get("catalog_provider")) ||
    (String(promoSnap.get("source") || "").toLowerCase() === "dotfit" ?
      "dotfit" :
      CATALOG_PROVIDER_GEN_HEALTH);
  if (provider !== CATALOG_PROVIDER_GEN_HEALTH) {
    return {code, skipped: true, reason: "not-gen-health"};
  }

  const state = readPromoState(promoSnap.get("state"));
  const ghAssignmentType = state === "generic" ? null : state;
  const assignedAffiliateIds = await listActiveOwnerAssigneeIdsForPromo(code);
  if (state === "locked" && assignedAffiliateIds.length > 1) {
    throw new HttpsError(
        "invalid-argument",
        `Locked promo "${code}" has multiple active assignments; fix in Promo codes before syncing.`,
    );
  }

  const usageLimitRaw = promoSnap.get("usageLimit");
  const usageLimit =
    usageLimitRaw == null || usageLimitRaw === "" ?
      null :
      typeof usageLimitRaw === "number" && Number.isFinite(usageLimitRaw) ?
        Math.round(usageLimitRaw) :
        Number.parseInt(String(usageLimitRaw), 10);

  const ghValidity = ghValidityFromPromoSnap(promoSnap);
  const ghAffiliates = await buildGhAffiliates(assignedAffiliateIds);
  const ghBody = {
    affiliates: ghAffiliates,
    assignmentType: ghAssignmentType,
    maxUsage: usageLimit,
    validity: ghValidity,
  };

  let ghPromo;
  try {
    ghPromo = await patchPromocodeToGenHealth(code, ghBody);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("pushPromoMirrorToGenHealth: PATCH failed", {code, message: msg});
    const lockedAffiliateConflict =
      /locked promocodes can only have one affiliate/i.test(msg);
    throw new HttpsError(
        lockedAffiliateConflict ? "invalid-argument" : "internal",
        msg || `Failed to sync promo "${code}" to Gen-Health.`,
    );
  }

  const affiliatesSnapshot = Array.isArray(ghPromo.affiliates) ? ghPromo.affiliates : ghAffiliates;
  await promoRef.set(
      {
        affiliatesSnapshot,
        assignedAffiliateIds,
        assignedAffiliateId: state === "locked" && assignedAffiliateIds.length > 0 ?
          assignedAffiliateIds[0] :
          null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
  );

  return {code, success: true};
}

module.exports = {
  buildGhAffiliates,
  buildGhValidityPatch,
  listActiveAssigneeIdsForPromo,
  listActiveOwnerAssigneeIdsForPromo,
  pushPromoMirrorToGenHealth,
  readPromoState,
  toValidityIsoTimestamp,
};
