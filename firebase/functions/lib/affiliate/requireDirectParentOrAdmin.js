/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const {HttpsError} = require("firebase-functions/v2/https");
const {db} = require("../../utils/Firebase.js");
const {assertDashboardPermission} = require("../admin/dashboardCallerAuth.js");

const USERS_COLLECTION = "Users";
const AFFILIATE_PROFILES_COLLECTION = "AffiliateProfiles";
const SUPER_ADMIN_ROLE = "super_admin";
const ADMIN_ROLE = "admin";
const AFFILIATE_ROLE = "affiliate";

/**
 * @param {string} callerUid
 * @param {string} targetUid
 * @return {Promise<{
 *   callerRole: 'super_admin' | 'admin' | 'affiliate',
 *   callerTier: 'super' | 'sub' | 'micro' | null,
 *   targetProfile: FirebaseFirestore.DocumentSnapshot,
 * }>}
 */
async function requireDirectParentOrAdmin(callerUid, targetUid) {
  const callerUserSnap = await db.collection(USERS_COLLECTION).doc(callerUid).get();
  if (!callerUserSnap.exists) {
    throw new HttpsError("permission-denied", "No dashboard profile.");
  }

  const callerRole = callerUserSnap.get("role");
  const targetRef = db.collection(AFFILIATE_PROFILES_COLLECTION).doc(targetUid);
  const targetProfile = await targetRef.get();

  if (callerRole === SUPER_ADMIN_ROLE) {
    if (!targetProfile.exists) {
      throw new HttpsError("not-found", "Affiliate profile not found.");
    }
    return {callerRole: "super_admin", callerTier: null, targetProfile};
  }

  if (callerRole === ADMIN_ROLE) {
    await assertDashboardPermission(callerUid, "affiliates");
    if (!targetProfile.exists) {
      throw new HttpsError("not-found", "Affiliate profile not found.");
    }
    return {callerRole: "admin", callerTier: null, targetProfile};
  }

  if (callerRole === AFFILIATE_ROLE) {
    const callerProfile = await db.collection(AFFILIATE_PROFILES_COLLECTION).doc(callerUid).get();
    if (!callerProfile.exists || !targetProfile.exists) {
      throw new HttpsError("not-found", "Affiliate profile not found.");
    }
    const parentId = String(targetProfile.get("parentAffiliateId") || "").trim();
    if (parentId !== callerUid) {
      throw new HttpsError(
          "permission-denied",
          "You can only manage your direct downline.",
      );
    }
    const callerTierRaw = callerProfile.get("tier");
    const callerTier =
      callerTierRaw === "super" || callerTierRaw === "sub" || callerTierRaw === "micro" ?
        callerTierRaw :
        null;
    return {
      callerRole: "affiliate",
      callerTier,
      targetProfile,
    };
  }

  throw new HttpsError("permission-denied", "Dashboard permission required.");
}

/**
 * Authorize creating a new descendant under `parentAffiliateId`.
 * Unlike requireDirectParentOrAdmin (target = existing child), the parent profile is the target.
 *
 * @param {string} callerUid
 * @param {string} parentAffiliateId
 * @return {Promise<{
 *   callerRole: 'super_admin' | 'admin' | 'affiliate',
 *   callerTier: 'super' | 'sub' | 'micro' | null,
 *   targetProfile: FirebaseFirestore.DocumentSnapshot,
 * }>}
 */
async function requireCallerIsParentOrAdmin(callerUid, parentAffiliateId) {
  const parentId = String(parentAffiliateId || "").trim();
  if (!parentId) {
    throw new HttpsError("invalid-argument", "parentAffiliateId is required.");
  }

  const callerUserSnap = await db.collection(USERS_COLLECTION).doc(callerUid).get();
  if (!callerUserSnap.exists) {
    throw new HttpsError("permission-denied", "No dashboard profile.");
  }

  const callerRole = callerUserSnap.get("role");
  const parentRef = db.collection(AFFILIATE_PROFILES_COLLECTION).doc(parentId);
  const parentProfile = await parentRef.get();

  if (callerRole === SUPER_ADMIN_ROLE) {
    if (!parentProfile.exists) {
      throw new HttpsError("not-found", "Affiliate profile not found.");
    }
    return {callerRole: "super_admin", callerTier: null, targetProfile: parentProfile};
  }

  if (callerRole === ADMIN_ROLE) {
    await assertDashboardPermission(callerUid, "affiliates");
    if (!parentProfile.exists) {
      throw new HttpsError("not-found", "Affiliate profile not found.");
    }
    return {callerRole: "admin", callerTier: null, targetProfile: parentProfile};
  }

  if (callerRole === AFFILIATE_ROLE) {
    if (parentId !== callerUid) {
      throw new HttpsError(
          "permission-denied",
          "You can only create descendants under your own affiliate account.",
      );
    }
    const callerProfile = await db.collection(AFFILIATE_PROFILES_COLLECTION).doc(callerUid).get();
    if (!callerProfile.exists) {
      throw new HttpsError("not-found", "Affiliate profile not found.");
    }
    const callerTierRaw = callerProfile.get("tier");
    const callerTier =
      callerTierRaw === "super" || callerTierRaw === "sub" || callerTierRaw === "micro" ?
        callerTierRaw :
        null;
    return {
      callerRole: "affiliate",
      callerTier,
      targetProfile: callerProfile,
    };
  }

  throw new HttpsError("permission-denied", "Dashboard permission required.");
}

module.exports = {
  requireDirectParentOrAdmin,
  requireCallerIsParentOrAdmin,
};
