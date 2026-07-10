/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const admin = require("firebase-admin");
const {HttpsError} = require("firebase-functions/v2/https");

const AFFILIATE_PROFILES_COLLECTION = "AffiliateProfiles";
const BATCH_SIZE = 450;

/**
 * Eager cascade pause: target + all non-deleted, not-already-paused descendants.
 * @param {*} db Firestore
 * @param {string} targetUid
 * @return {Promise<{ success: boolean, alreadyPaused?: boolean, cascadeCount: number }>}
 */
async function pauseAffiliateSubtree(db, targetUid) {
  const targetRef = db.collection(AFFILIATE_PROFILES_COLLECTION).doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new HttpsError("not-found", "Affiliate profile not found.");
  }
  if (targetSnap.get("deletedAt") != null) {
    throw new HttpsError("failed-precondition", "Cannot pause a deleted affiliate. Restore first.");
  }
  if (targetSnap.get("paused") === true && targetSnap.get("pausedAncestorUid") == null) {
    return {success: true, alreadyPaused: true, cascadeCount: 0};
  }

  const descendantSnap = await db.collection(AFFILIATE_PROFILES_COLLECTION)
      .where("ancestorIds", "array-contains", targetUid)
      .get();

  const cascadeUids = descendantSnap.docs
      .filter((d) => d.get("deletedAt") == null && d.get("paused") !== true)
      .map((d) => d.id);

  const now = admin.firestore.FieldValue.serverTimestamp();
  const allProfileUpdates = [
    {
      ref: targetRef,
      data: {
        paused: true,
        pausedAncestorUid: null,
        updatedAt: now,
      },
    },
    ...cascadeUids.map((cascadeUid) => ({
      ref: db.collection(AFFILIATE_PROFILES_COLLECTION).doc(cascadeUid),
      data: {
        paused: true,
        pausedAncestorUid: targetUid,
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
    cascadeCount: cascadeUids.length,
  };
}

module.exports = {pauseAffiliateSubtree};
