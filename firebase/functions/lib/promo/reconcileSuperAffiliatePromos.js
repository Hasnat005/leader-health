/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const admin = require("firebase-admin");
const {HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {db} = require("../../utils/Firebase.js");
const {normalizePromoCodeId, promoAssignmentDocId} = require("./normalize.js");
const {
  reconcileAssignments,
  cascadeRevokeAfterOwnerRemoval,
} = require("./reconcileAssignments.js");
const {cascadeRevokeAssignments} = require("./cascadeRevokeAssignments.js");
const {readPromoState, pushPromoMirrorToGenHealth} = require("./pushPromoMirrorToGenHealth.js");
const {
  CATALOG_PROVIDER_GEN_HEALTH,
  normalizeCatalogProvider,
} = require("../catalogProvider.js");

const PROMO_CODES_COLLECTION = "PromoCodes";
const PROMO_CODE_ASSIGNMENTS_COLLECTION = "PromoCodeAssignments";
const AFFILIATE_PROFILES_COLLECTION = "AffiliateProfiles";

/**
 * Active owner uids for a promo (`role: "owner"` only).
 * @param {*} firestore
 * @param {string} promoCodeId
 * @return {Promise<string[]>}
 */
async function listActiveOwnerIdsForPromo(firestore, promoCodeId) {
  const snap = await firestore.collection(PROMO_CODE_ASSIGNMENTS_COLLECTION)
      .where("promoCodeId", "==", promoCodeId)
      .where("role", "==", "owner")
      .where("active", "==", true)
      .get();
  const ids = new Set();
  for (const d of snap.docs) {
    const aid = String(d.data()?.affiliateId || "").trim();
    if (aid) ids.add(aid);
  }
  return [...ids];
}

/**
 * Promo codes this super currently holds (any non-descendant active row).
 * @param {*} firestore
 * @param {string} superUid
 * @return {Promise<Set<string>>}
 */
async function listSuperHeldPromoCodes(firestore, superUid) {
  const snap = await firestore.collection(PROMO_CODE_ASSIGNMENTS_COLLECTION)
      .where("affiliateId", "==", superUid)
      .where("active", "==", true)
      .get();
  const codes = new Set();
  for (const d of snap.docs) {
    if (d.data()?.role === "descendant") continue;
    const code = normalizePromoCodeId(String(d.data()?.promoCodeId || ""));
    if (code) codes.add(code);
  }
  return codes;
}

/**
 * Deactivate a super's direct promo row when reconciling removal (covers rows missing `role`).
 * @param {*} firestore
 * @param {string} code
 * @param {string} superUid
 * @return {Promise<boolean>} true when a row was deactivated
 */
async function deactivateSuperPromoRowIfPresent(firestore, code, superUid) {
  const ref = firestore.collection(PROMO_CODE_ASSIGNMENTS_COLLECTION)
      .doc(promoAssignmentDocId(code, superUid));
  const snap = await ref.get();
  if (!snap.exists || snap.get("active") === false) return false;
  if (snap.get("role") === "descendant") return false;

  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set({active: false, updatedAt: now}, {merge: true});
  await firestore.collection(AFFILIATE_PROFILES_COLLECTION).doc(superUid).set({
    assignedPromoCodes: admin.firestore.FieldValue.arrayRemove(code),
    assignedPromoCodeId: null,
    updatedAt: now,
  }, {merge: true});
  return true;
}

/**
 * Reconcile PromoCodeAssignments for one Super's promo pocket using the same owner
 * model as `patchPromoSettings` / `reconcileAssignments` (always writes `role: "owner"`).
 *
 * @param {string} superUid
 * @param {string[]} nextPromoCodeIds Normalized promo ids the super should hold as owner
 * @param {string} callerUid Dashboard user performing the save
 * @return {Promise<{ success: boolean, superUid: string, codesProcessed: number }>}
 */
async function reconcileSuperAffiliatePromoAssignments(superUid, nextPromoCodeIds, callerUid) {
  const superId = String(superUid || "").trim();
  if (!superId) {
    throw new HttpsError("invalid-argument", "superUid is required.");
  }

  const profileSnap = await db.collection(AFFILIATE_PROFILES_COLLECTION).doc(superId).get();
  if (!profileSnap.exists || profileSnap.get("tier") !== "super") {
    throw new HttpsError("failed-precondition", "Super affiliate profile required.");
  }

  const nextSet = new Set(
      nextPromoCodeIds.map((c) => normalizePromoCodeId(c)).filter(Boolean),
  );

  const heldCodes = await listSuperHeldPromoCodes(db, superId);
  const profileCodes = Array.isArray(profileSnap.get("assignedPromoCodes")) ?
    profileSnap.get("assignedPromoCodes") :
    [];
  /** @type {Set<string>} */
  const allCodes = new Set([...nextSet, ...heldCodes]);
  for (const raw of profileCodes) {
    const c = normalizePromoCodeId(String(raw || ""));
    if (c) allCodes.add(c);
  }

  for (const code of allCodes) {
    const promoSnap = await db.collection(PROMO_CODES_COLLECTION).doc(code).get();
    if (!promoSnap.exists) {
      logger.warn("reconcileSuperAffiliatePromos: promo doc missing", {code, superUid: superId});
      continue;
    }

    const state = readPromoState(promoSnap.get("state"));
    const prevOwnerIds = await listActiveOwnerIdsForPromo(db, code);

    let nextOwnerIds;
    if (nextSet.has(code)) {
      nextOwnerIds = state === "locked" ?
        [superId] :
        [...new Set([...prevOwnerIds, superId])];
    } else {
      nextOwnerIds = prevOwnerIds.filter((id) => id !== superId);
      const hadOrphanRow = await deactivateSuperPromoRowIfPresent(db, code, superId);
      if (hadOrphanRow) {
        await cascadeRevokeAssignments(db, code, promoAssignmentDocId(code, superId));
      }
    }

    const {batch, removedIds} = await reconcileAssignments(
        code,
        state,
        nextOwnerIds,
        promoSnap,
        callerUid,
    );
    await batch.commit();

    if (removedIds.length > 0) {
      await cascadeRevokeAfterOwnerRemoval(code, removedIds);
    }

    const provider =
      normalizeCatalogProvider(promoSnap.get("catalog_provider")) ||
      (String(promoSnap.get("source") || "").toLowerCase() === "dotfit" ?
        "dotfit" :
        CATALOG_PROVIDER_GEN_HEALTH);
    if (provider === CATALOG_PROVIDER_GEN_HEALTH) {
      try {
        await pushPromoMirrorToGenHealth(code);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn("reconcileSuperAffiliatePromos: Gen-Health mirror failed", {code, msg});
      }
    }
  }

  logger.info("reconcileSuperAffiliatePromos: done", {
    superUid: superId,
    nextCount: nextSet.size,
    codesProcessed: allCodes.size,
  });

  return {success: true, superUid: superId, codesProcessed: allCodes.size};
}

module.exports = {reconcileSuperAffiliatePromoAssignments};
