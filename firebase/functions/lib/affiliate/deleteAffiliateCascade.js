/* eslint-disable max-len, require-jsdoc */

const logger = require("firebase-functions/logger");
const {HttpsError} = require("firebase-functions/v2/https");
const {auth, db} = require("../../utils/Firebase.js");
const {normalizePromoCodeId} = require("../promo/normalize.js");
const {pushPromoMirrorToGenHealth} = require("../promo/pushPromoMirrorToGenHealth.js");

const USERS_COLLECTION = "Users";
const AFFILIATE_PROFILES_COLLECTION = "AffiliateProfiles";
const PROMO_CODE_ASSIGNMENTS_COLLECTION = "PromoCodeAssignments";
const AFFILIATE_ROLE = "affiliate";
const BATCH_SIZE = 450;

/**
 * @param {string} uid
 * @return {Promise<string[]>}
 */
async function collectPromoCodesForAffiliate(uid) {
  const codes = new Set();
  let moreAssignments = true;
  while (moreAssignments) {
    const snap = await db.collection(PROMO_CODE_ASSIGNMENTS_COLLECTION)
        .where("affiliateId", "==", uid)
        .limit(BATCH_SIZE)
        .get();
    if (snap.empty) {
      moreAssignments = false;
      continue;
    }
    for (const d of snap.docs) {
      const c = normalizePromoCodeId(String(d.data().promoCodeId || ""));
      if (c) codes.add(c);
    }
    if (snap.size < BATCH_SIZE) moreAssignments = false;
  }

  const profileSnap = await db.collection(AFFILIATE_PROFILES_COLLECTION).doc(uid).get();
  if (profileSnap.exists) {
    for (const raw of profileSnap.get("assignedPromoCodes") || []) {
      const c = normalizePromoCodeId(String(raw || ""));
      if (c) codes.add(c);
    }
  }

  return [...codes];
}

/**
 * Permanently removes one affiliate node (assignments, subcollections, profile, Users, Auth).
 * @param {string} uid
 * @return {Promise<{ ownerPromoCodes: string[] }>}
 */
async function deleteAffiliateCascadeSingle(uid) {
  const ownerPromoCodes = new Set();

  let moreAssignments = true;
  while (moreAssignments) {
    const snap = await db.collection(PROMO_CODE_ASSIGNMENTS_COLLECTION)
        .where("affiliateId", "==", uid)
        .limit(BATCH_SIZE)
        .get();
    if (snap.empty) {
      moreAssignments = false;
      continue;
    }
    const batch = db.batch();
    for (const d of snap.docs) {
      const code = normalizePromoCodeId(String(d.data().promoCodeId || ""));
      if (code && d.get("role") === "owner" && d.get("active") !== false) {
        ownerPromoCodes.add(code);
      }
      batch.delete(d.ref);
    }
    await batch.commit();
    if (snap.size < BATCH_SIZE) moreAssignments = false;
  }

  const profileRef = db.collection(AFFILIATE_PROFILES_COLLECTION).doc(uid);
  const profileSnap = await profileRef.get();
  if (profileSnap.exists) {
    const subcols = await profileRef.listCollections();
    for (const colRef of subcols) {
      let moreDocs = true;
      while (moreDocs) {
        const snap = await colRef.limit(BATCH_SIZE).get();
        if (snap.empty) {
          moreDocs = false;
          continue;
        }
        const batch = db.batch();
        for (const d of snap.docs) batch.delete(d.ref);
        await batch.commit();
        if (snap.size < BATCH_SIZE) moreDocs = false;
      }
    }
    await profileRef.delete();
  }

  await db.collection(USERS_COLLECTION).doc(uid).delete();

  try {
    await auth.deleteUser(uid);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    if (code === "auth/user-not-found") {
      return {ownerPromoCodes: [...ownerPromoCodes]};
    }
    logger.error("deleteAffiliateCascadeSingle: auth.deleteUser failed", {uid, err});
    throw err;
  }

  return {ownerPromoCodes: [...ownerPromoCodes]};
}

/**
 * @param {string} callerUid
 * @param {string} targetUid
 */
async function deleteAffiliateCascade(callerUid, targetUid) {
  const uid = String(targetUid || "").trim();
  if (!uid) {
    throw new HttpsError("invalid-argument", "uid is required.");
  }
  if (!callerUid || callerUid === uid) {
    throw new HttpsError("invalid-argument", "You cannot delete your own account.");
  }

  const userSnap = await db.collection(USERS_COLLECTION).doc(uid).get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "Affiliate not found.");
  }
  if (userSnap.get("role") !== AFFILIATE_ROLE) {
    throw new HttpsError("failed-precondition", "User is not an affiliate.");
  }

  const promoCodesToSync = await collectPromoCodesForAffiliate(uid);
  const {ownerPromoCodes} = await deleteAffiliateCascadeSingle(uid);

  const syncSet = new Set([...promoCodesToSync, ...ownerPromoCodes]);
  if (syncSet.size > 0) {
    logger.info("deleteAffiliateCascade: syncing Gen-Health after assignment removal", {
      uid,
      promoCodes: [...syncSet],
    });
    for (const code of syncSet) {
      await pushPromoMirrorToGenHealth(code);
    }
  }
}

module.exports = {deleteAffiliateCascade, deleteAffiliateCascadeSingle};
