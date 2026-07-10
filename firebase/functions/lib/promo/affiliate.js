/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

/**
 * Firestore helpers for AffiliateProfiles and PromoCodeAssignments lookups.
 */

const {normalizeUtmSlug, promoAssignmentDocId} = require("./normalize.js");

/**
 * True when affiliate belongs to the same tree as the locked-promo owner Super.
 * @param {*} affiliateSnap
 * @param {string} ownerSuperUid
 * @return {boolean}
 */
function affiliateInOwnerTree(affiliateSnap, ownerSuperUid) {
  if (!affiliateSnap || !affiliateSnap.exists) return false;
  const root = String(affiliateSnap.get("rootSuperAffiliateId") || "").trim();
  return root === ownerSuperUid;
}

const AFFILIATE_PROFILES = "AffiliateProfiles";
const PROMO_CODE_ASSIGNMENTS = "PromoCodeAssignments";

/**
 * @param {*} db Firestore
 * @param {string} slug
 * @return {Promise<import("firebase-admin/firestore").DocumentSnapshot | null>}
 */
async function findAffiliateProfileBySlug(db, slug) {
  const s = normalizeUtmSlug(slug);
  if (!s) return null;
  const snap = await db
      .collection(AFFILIATE_PROFILES)
      .where("utmSlug", "==", s)
      .limit(2)
      .get();
  if (snap.empty) return null;
  return snap.docs[0] || null;
}

/**
 * @param {*} snap DocumentSnapshot
 * @return {boolean}
 */
function isProfilePaused(snap) {
  if (!snap || !snap.exists) return true;
  return snap.data()?.paused === true;
}

/**
 * v2: paused OR soft-deleted.
 * @param {*} snap DocumentSnapshot
 * @return {boolean}
 */
function isEffectivelyInactive(snap) {
  if (!snap || !snap.exists) return true;
  const d = snap.data();
  return d?.paused === true || d?.deletedAt != null;
}

/**
 * v2: locked-promo owner lookup — role: 'owner' only.
 * @param {*} db Firestore
 * @param {string} promoCodeId
 * @return {Promise<string | null>}
 */
async function findActiveOwnerAffiliateId(db, promoCodeId) {
  const snap = await db
      .collection(PROMO_CODE_ASSIGNMENTS)
      .where("promoCodeId", "==", promoCodeId)
      .where("role", "==", "owner")
      .where("active", "==", true)
      .limit(5)
      .get();
  const ids = new Set();
  for (const d of snap.docs) {
    const aid = d.data()?.affiliateId;
    if (typeof aid === "string" && aid.trim()) ids.add(aid.trim());
  }
  if (ids.size === 1) return [...ids][0];
  return null;
}

/**
 * Returns the single active affiliate id assigned to a promo code,
 * or null if there are zero or multiple distinct affiliates.
 *
 * @param {*} db Firestore
 * @param {string} promoCodeId
 * @return {Promise<string | null>}
 */
async function findActiveAssignmentAffiliateId(db, promoCodeId) {
  const snap = await db
      .collection(PROMO_CODE_ASSIGNMENTS)
      .where("promoCodeId", "==", promoCodeId)
      .where("active", "==", true)
      .limit(5)
      .get();
  const ids = new Set();
  for (const d of snap.docs) {
    const aid = d.data()?.affiliateId;
    if (typeof aid === "string" && aid.trim()) ids.add(aid.trim());
  }
  if (ids.size === 1) return [...ids][0];
  return null;
}

/**
 * @param {*} db Firestore
 * @param {string} promoCodeId
 * @param {string} affiliateId
 * @return {Promise<boolean>}
 */
async function isPromoAssignmentActive(db, promoCodeId, affiliateId) {
  const assignSnap = await db
      .collection(PROMO_CODE_ASSIGNMENTS)
      .doc(promoAssignmentDocId(promoCodeId, affiliateId))
      .get();
  return assignSnap.exists && assignSnap.data()?.active !== false;
}

module.exports = {
  AFFILIATE_PROFILES,
  PROMO_CODE_ASSIGNMENTS,
  findAffiliateProfileBySlug,
  isProfilePaused,
  isEffectivelyInactive,
  affiliateInOwnerTree,
  findActiveAssignmentAffiliateId,
  findActiveOwnerAffiliateId,
  isPromoAssignmentActive,
};

/* eslint-enable valid-jsdoc, max-len, require-jsdoc */
