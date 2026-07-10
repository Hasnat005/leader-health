/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const admin = require("firebase-admin");

const BATCH_MAX = 450;

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} input
 * @param {string} input.affiliateProfileId
 * @param {string} input.commissionPayoutId
 * @param {string} input.affiliatePayoutId
 * @param {number} input.totalCents
 * @param {string} input.processorType
 * @param {string} [input.processorRef]
 * @param {string[]} input.orderIds
 * @param {string | null} [input.note]
 * @param {string | null} [input.invoiceStoragePath] Firebase Storage object path for PDF invoice
 * @return {Promise<void>}
 */
async function recordSuccessfulPayout(db, input) {
  const {
    affiliateProfileId,
    commissionPayoutId,
    affiliatePayoutId,
    totalCents,
    processorType,
    processorRef,
    orderIds,
    note,
    invoiceStoragePath,
  } = input;

  const payoutsCol = db.collection("AffiliateProfiles").doc(affiliateProfileId).collection("Payouts");

  await payoutsCol.doc(commissionPayoutId).set({
    commissionPayoutId,
    affiliatePayoutId,
    paidAt: admin.firestore.FieldValue.serverTimestamp(),
    totalCents,
    processorType,
    processorRef: processorRef || null,
    orderIds,
    note: note || null,
    invoiceStoragePath:
      typeof invoiceStoragePath === "string" && invoiceStoragePath.trim() ?
        invoiceStoragePath.trim() :
        null,
  });

  const paidAt = admin.firestore.FieldValue.serverTimestamp();
  const payoutRefField = commissionPayoutId;

  for (let i = 0; i < orderIds.length; i += BATCH_MAX) {
    const chunk = orderIds.slice(i, i + BATCH_MAX);
    const batch = db.batch();
    for (const orderId of chunk) {
      const ref = db.collection("AffiliateProfiles").doc(affiliateProfileId).collection("Orders").doc(orderId);
      batch.update(ref, {
        commissionPaid: true,
        commissionPaidAt: paidAt,
        commissionPayoutId: payoutRefField,
      });
    }
    await batch.commit();
  }
}

module.exports = {recordSuccessfulPayout};
