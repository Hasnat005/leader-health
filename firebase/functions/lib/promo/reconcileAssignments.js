/* eslint-disable valid-jsdoc, max-len, require-jsdoc */
const admin = require("firebase-admin");
const {HttpsError} = require("firebase-functions/v2/https");
const {db} = require("../../utils/Firebase.js");
const {promoAssignmentDocId} = require("./normalize.js");
const {cascadeRevokeAssignments} = require("./cascadeRevokeAssignments.js");

const PROMO_CODE_ASSIGNMENTS_COLLECTION = "PromoCodeAssignments";
const AFFILIATE_PROFILES_COLLECTION = "AffiliateProfiles";

/**
 * @param {string} code
 * @param {'locked' | 'shared' | 'generic'} state
 * @param {string[]} nextAssignedIds Owner Super affiliate uids from admin UI
 * @param {FirebaseFirestore.DocumentSnapshot} promoSnap
 * @param {string} callerUid
 */
async function reconcileAssignments(code, state, nextAssignedIds, promoSnap, callerUid) {
  const activeOwnersQ = await db.collection(PROMO_CODE_ASSIGNMENTS_COLLECTION)
      .where("promoCodeId", "==", code)
      .where("active", "==", true)
      .where("role", "==", "owner")
      .get();

  const prevOwnerIds = new Set(
      activeOwnersQ.docs
          .map((d) => d.data().affiliateId)
          .filter((x) => typeof x === "string" && x.trim() !== "")
          .map((x) => String(x).trim()),
  );

  if (state === "locked" && nextAssignedIds.length > 1) {
    throw new HttpsError("invalid-argument", "Locked promo codes can only be assigned to one affiliate.");
  }

  if (state === "locked") {
    for (const d of activeOwnersQ.docs) {
      const other = d.data().affiliateId;
      if (other && String(other).trim() && !nextAssignedIds.includes(String(other).trim())) {
        const otherTrim = String(other).trim();
        if (nextAssignedIds.length > 0 && otherTrim !== nextAssignedIds[0]) {
          throw new HttpsError(
              "failed-precondition",
              `Locked code "${code}" is already assigned to another affiliate.`,
          );
        }
      }
    }
  }

  const removedIds = [...prevOwnerIds].filter((id) => !nextAssignedIds.includes(id));
  const addedIds = nextAssignedIds.filter((id) => !prevOwnerIds.has(id));
  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();

  for (const affiliateId of removedIds) {
    const assignRef = db.collection(PROMO_CODE_ASSIGNMENTS_COLLECTION).doc(promoAssignmentDocId(code, affiliateId));
    batch.set(
        assignRef,
        {promoCodeId: code, affiliateId, active: false, updatedAt: now},
        {merge: true},
    );
    const profileRef = db.collection(AFFILIATE_PROFILES_COLLECTION).doc(affiliateId);
    batch.set(
        profileRef,
        {
          assignedPromoCodes: admin.firestore.FieldValue.arrayRemove(code),
          assignedPromoCodeId: null,
          updatedAt: now,
        },
        {merge: true},
    );
  }

  for (const affiliateId of nextAssignedIds) {
    const assignRef = db.collection(PROMO_CODE_ASSIGNMENTS_COLLECTION).doc(promoAssignmentDocId(code, affiliateId));
    const assignSnap = await assignRef.get();
    const isNew = !assignSnap.exists || assignSnap.data()?.active !== true;
    if (isNew && state === "locked") {
      for (const d of activeOwnersQ.docs) {
        const other = d.data().affiliateId;
        if (other && String(other).trim() !== affiliateId) {
          throw new HttpsError(
              "failed-precondition",
              `Locked code "${code}" is already assigned to another affiliate.`,
          );
        }
      }
    }
    batch.set(
        assignRef,
        {
          promoCodeId: code,
          affiliateId,
          active: true,
          role: "owner",
          rootSuperAffiliateId: affiliateId,
          parentAssignmentId: null,
          assignedByUid: callerUid || "system",
          ...(isNew ? {assignedAt: now} : {}),
          ...(assignSnap.exists ? {} : {createdAt: now}),
          updatedAt: now,
        },
        {merge: true},
    );

    const profileRef = db.collection(AFFILIATE_PROFILES_COLLECTION).doc(affiliateId);
    const profileSnap = await profileRef.get();
    batch.set(
        profileRef,
        {
          ...(profileSnap.exists ? {} : {paused: false, createdAt: now}),
          assignedPromoCodes: admin.firestore.FieldValue.arrayUnion(code),
          assignedPromoCodeId: null,
          updatedAt: now,
        },
        {merge: true},
    );
  }

  const usageCount = typeof promoSnap.get("usageCount") === "number" ? promoSnap.get("usageCount") : 0;
  return {batch, removedIds, addedIds, usageCount, now};
}

/**
 * Cascade-revoke descendants after owner rows are deactivated (call after batch.commit).
 * @param {string} code
 * @param {string[]} removedOwnerIds
 * @return {Promise<number>}
 */
async function cascadeRevokeAfterOwnerRemoval(code, removedOwnerIds) {
  let total = 0;
  for (const affiliateId of removedOwnerIds) {
    const parentDocId = promoAssignmentDocId(code, affiliateId);
    total += await cascadeRevokeAssignments(db, code, parentDocId);
  }
  return total;
}

module.exports = {reconcileAssignments, cascadeRevokeAfterOwnerRemoval};
