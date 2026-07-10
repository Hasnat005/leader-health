/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const admin = require("firebase-admin");

const PROMO_CODE_ASSIGNMENTS_COLLECTION = "PromoCodeAssignments";
const AFFILIATE_PROFILES_COLLECTION = "AffiliateProfiles";
const BATCH_SIZE = 450;

/**
 * Deactivates all descendant assignment rows for a promo under a parent assignment doc id.
 * @param {*} db Firestore
 * @param {string} code Normalized promo code id
 * @param {string} parentAssignmentDocId e.g. `${code}::${parentUid}`
 * @return {Promise<number>} Number of descendant rows deactivated (not including parent)
 */
async function cascadeRevokeAssignments(db, code, parentAssignmentDocId) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  /** @type {string[]} */
  const queue = [parentAssignmentDocId];
  let revokedCount = 0;

  while (queue.length > 0) {
    const parentId = queue.shift();
    if (!parentId) continue;

    const childrenSnap = await db.collection(PROMO_CODE_ASSIGNMENTS_COLLECTION)
        .where("promoCodeId", "==", code)
        .where("parentAssignmentId", "==", parentId)
        .where("active", "==", true)
        .get();

    if (childrenSnap.empty) continue;

    let batch = db.batch();
    let batchCount = 0;

    for (const childDoc of childrenSnap.docs) {
      const childAffiliateId = String(childDoc.get("affiliateId") || "").trim();
      batch.update(childDoc.ref, {active: false, updatedAt: now});
      batchCount++;
      revokedCount++;

      if (childAffiliateId) {
        const profileRef = db.collection(AFFILIATE_PROFILES_COLLECTION).doc(childAffiliateId);
        batch.set(
            profileRef,
            {
              assignedPromoCodes: admin.firestore.FieldValue.arrayRemove(code),
              updatedAt: now,
            },
            {merge: true},
        );
        batchCount++;
      }

      queue.push(childDoc.id);

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }
  }

  return revokedCount;
}

module.exports = {cascadeRevokeAssignments};
