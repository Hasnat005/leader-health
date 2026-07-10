/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const {HttpsError} = require("firebase-functions/v2/https");

const AFFILIATE_PROFILES_COLLECTION = "AffiliateProfiles";

/**
 * @param {unknown} raw
 * @return {number}
 */
function readCommissionRatePercent(raw) {
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Sum commissionRate for active direct children of expected tier.
 * @param {FirebaseFirestore.Firestore} firestore
 * @param {string} parentAffiliateId
 * @param {"sub" | "micro"} expectedChildTier
 * @param {string} [excludeUid] Child uid to omit (updates)
 * @return {Promise<number>}
 */
async function sumDirectDownlineCommissionRates(
    firestore,
    parentAffiliateId,
    expectedChildTier,
    excludeUid = "",
) {
  const snap = await firestore.collection(AFFILIATE_PROFILES_COLLECTION)
      .where("parentAffiliateId", "==", parentAffiliateId)
      .get();

  let sum = 0;
  for (const doc of snap.docs) {
    if (excludeUid && doc.id === excludeUid) continue;
    if (doc.get("deletedAt") != null) continue;
    const tier = String(doc.get("tier") || "").trim();
    if (tier !== expectedChildTier) continue;
    sum += readCommissionRatePercent(doc.get("commissionRate"));
  }
  return sum;
}

/**
 * @param {number} existingSum
 * @param {number} newRate
 * @param {"sub" | "micro"} childTier
 */
function assertDownlineCommissionPoolWithinCap(existingSum, newRate, childTier) {
  const total = Math.round((existingSum + newRate) * 100) / 100;
  if (total > 100) {
    const label = childTier === "sub" ? "Sub-affiliate" : "Micro-affiliate";
    throw new HttpsError(
        "failed-precondition",
        `${label} commission rates cannot exceed 100% of your team pool combined ` +
        `(current other members: ${existingSum}%, requested: ${newRate}%, total: ${total}%).`,
    );
  }
}

/**
 * @param {FirebaseFirestore.Firestore} firestore
 * @param {string} parentAffiliateId
 * @param {"sub" | "micro"} childTier
 * @param {number} newRate
 * @param {string} [excludeUid]
 */
async function validateDownlineCommissionPool(
    firestore,
    parentAffiliateId,
    childTier,
    newRate,
    excludeUid = "",
) {
  const existing = await sumDirectDownlineCommissionRates(
      firestore,
      parentAffiliateId,
      childTier,
      excludeUid,
  );
  assertDownlineCommissionPoolWithinCap(existing, newRate, childTier);
}

module.exports = {
  readCommissionRatePercent,
  sumDirectDownlineCommissionRates,
  assertDownlineCommissionPoolWithinCap,
  validateDownlineCommissionPool,
};
