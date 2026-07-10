/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const admin = require("firebase-admin");
const {HttpsError} = require("firebase-functions/v2/https");

const AFFILIATE_PROFILES_COLLECTION = "AffiliateProfiles";
const BATCH_SIZE = 450;

/**
 * Eager cascade unpause: target + descendants paused by this target's cascade.
 * @param {*} db Firestore
 * @param {string} targetUid
 * @return {Promise<{ success: boolean, alreadyUnpaused?: boolean, cascadeCount: number }>}
 */
async function unpauseAffiliateSubtree(db, targetUid) {
  const targetRef = db.collection(AFFILIATE_PROFILES_COLLECTION).doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new HttpsError("not-found", "Affiliate profile not found.");
  }
  if (targetSnap.get("deletedAt") != null) {
    throw new HttpsError("failed-precondition", "Cannot unpause a deleted affiliate. Restore first.");
  }
  if (targetSnap.get("paused") !== true) {
    return {success: true, alreadyUnpaused: true, cascadeCount: 0};
  }

  const pausedAncestorUid = targetSnap.get("pausedAncestorUid");
  if (pausedAncestorUid != null && String(pausedAncestorUid).trim() !== "") {
    throw new HttpsError(
        "failed-precondition",
        "Parent affiliate is still paused.",
    );
  }

  const parentId = String(targetSnap.get("parentAffiliateId") || "").trim();
  if (parentId) {
    const parentSnap = await db.collection(AFFILIATE_PROFILES_COLLECTION).doc(parentId).get();
    if (parentSnap.exists && parentSnap.get("paused") === true) {
      throw new HttpsError(
          "failed-precondition",
          "Parent affiliate is still paused.",
      );
    }
  }

  const descendantSnap = await db.collection(AFFILIATE_PROFILES_COLLECTION)
      .where("ancestorIds", "array-contains", targetUid)
      .get();

  const reversalUids = descendantSnap.docs
      .filter((d) => d.get("pausedAncestorUid") === targetUid)
      .map((d) => d.id);

  const now = admin.firestore.FieldValue.serverTimestamp();
  const allProfileUpdates = [
    {
      ref: targetRef,
      data: {
        paused: false,
        pausedAncestorUid: null,
        updatedAt: now,
      },
    },
    ...reversalUids.map((cascadeUid) => ({
      ref: db.collection(AFFILIATE_PROFILES_COLLECTION).doc(cascadeUid),
      data: {
        paused: false,
        pausedAncestorUid: null,
        updatedAt: now,
      },
    })),
  ];

  for (let i = 0; i < allProfileUpdates.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const item of allProfileUpdates.slice(i, i + BATCH_SIZE)) {
      batch.update(item.ref, item.data);
    }
    await batch.commit();
  }

  return {
    success: true,
    cascadeCount: reversalUids.length,
  };
}

module.exports = {unpauseAffiliateSubtree};
