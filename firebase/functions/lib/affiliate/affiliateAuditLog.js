/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const admin = require("firebase-admin");

const AFFILIATE_PROFILES_COLLECTION = "AffiliateProfiles";

/**
 * @param {*} db Firestore
 * @param {string} targetUid
 * @param {{
 *   event: string,
 *   actorUid: string,
 *   actorTier?: string | null,
 *   meta?: Record<string, unknown>,
 * }} entry
 */
async function appendAuditLog(db, targetUid, entry) {
  await db
      .collection(AFFILIATE_PROFILES_COLLECTION)
      .doc(targetUid)
      .collection("AuditLog")
      .add({
        event: entry.event,
        actorUid: entry.actorUid,
        actorTier: entry.actorTier ?? null,
        targetUid,
        meta: entry.meta ?? {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
}

module.exports = {appendAuditLog};
