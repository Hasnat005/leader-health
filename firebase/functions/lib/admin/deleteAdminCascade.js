/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const logger = require("firebase-functions/logger");
const {HttpsError} = require("firebase-functions/v2/https");
const {auth, db} = require("../../utils/Firebase.js");

const USERS_COLLECTION = "Users";
const ADMIN_PROFILES_COLLECTION = "AdminProfiles";
const WELCOME_TOKENS_COLLECTION = "WelcomeTokens";

const BATCH_PAGE = 450;

/**
 * Delete all docs in a query in pages.
 * @param {FirebaseFirestore.Query} q
 */
async function deleteQueryInPages(q) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await q.limit(BATCH_PAGE).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    if (snap.size < BATCH_PAGE) break;
  }
}

/**
 * @param {string} uid
 */
async function deleteAdminCascade(uid) {
  if (!uid) return;

  try {
    await db.collection(ADMIN_PROFILES_COLLECTION).doc(uid).delete();
  } catch (err) {
    logger.warn("deleteAdminCascade: AdminProfiles delete failed", {uid, err});
  }

  try {
    const q = db.collection(WELCOME_TOKENS_COLLECTION).where("uid", "==", uid);
    await deleteQueryInPages(q);
  } catch (err) {
    logger.warn("deleteAdminCascade: WelcomeTokens cleanup failed", {uid, err});
  }

  try {
    await db.collection(USERS_COLLECTION).doc(uid).delete();
  } catch (err) {
    logger.warn("deleteAdminCascade: Users delete failed", {uid, err});
  }

  try {
    await auth.deleteUser(uid);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    if (code !== "auth/user-not-found") {
      logger.error("deleteAdminCascade: auth.deleteUser failed", err);
      throw new HttpsError("internal", "Could not delete auth user.");
    }
  }
}

module.exports = {deleteAdminCascade};
