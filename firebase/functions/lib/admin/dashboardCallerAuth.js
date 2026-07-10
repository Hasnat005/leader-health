/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const {HttpsError} = require("firebase-functions/v2/https");
const {db} = require("../../utils/Firebase.js");

const USERS_COLLECTION = "Users";
const ADMIN_PROFILES_COLLECTION = "AdminProfiles";
const SUPER_ADMIN_ROLE = "super_admin";
const ADMIN_ROLE = "admin";

/**
 * @param {string} callerUid
 * @param {string} permissionKey
 */
async function assertDashboardPermission(callerUid, permissionKey) {
  if (!callerUid || typeof permissionKey !== "string" || !permissionKey.trim()) {
    throw new HttpsError("invalid-argument", "callerUid and permissionKey are required.");
  }

  const userSnap = await db.collection(USERS_COLLECTION).doc(callerUid).get();
  if (!userSnap.exists) {
    throw new HttpsError("permission-denied", "No dashboard profile.");
  }
  const role = userSnap.get("role");
  if (role === SUPER_ADMIN_ROLE) {
    return;
  }
  if (role !== ADMIN_ROLE) {
    throw new HttpsError("permission-denied", "Dashboard permission required.");
  }

  const profSnap = await db.collection(ADMIN_PROFILES_COLLECTION).doc(callerUid).get();
  if (!profSnap.exists) {
    throw new HttpsError("permission-denied", "Admin profile missing.");
  }
  const paused = profSnap.get("paused");
  if (paused === true) {
    throw new HttpsError("permission-denied", "Account is paused.");
  }
  const perms = profSnap.get("permissions");
  if (!perms || typeof perms !== "object") {
    throw new HttpsError("permission-denied", "No permissions configured.");
  }
  const level = perms[permissionKey];
  if (level !== "read") {
    throw new HttpsError("permission-denied", "Insufficient permission for this action.");
  }
}

module.exports = {assertDashboardPermission};
