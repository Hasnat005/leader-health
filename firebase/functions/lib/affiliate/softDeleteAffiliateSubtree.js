/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const {HttpsError} = require("firebase-functions/v2/https");
const {pushPromoMirrorToGenHealth} = require("../promo/pushPromoMirrorToGenHealth.js");

const AFFILIATE_PROFILES_COLLECTION = "AffiliateProfiles";
const PROMO_CODE_ASSIGNMENTS_COLLECTION = "PromoCodeAssignments";
const BATCH_SIZE = 450;

/**
 * @param {*} db Firestore
 * @param {string} targetUid
 * @param {string} callerUid
 * @param {string | null | undefined} deletedReason
 * @return {Promise<{
 *   success: boolean,
 *   alreadyDeleted?: boolean,
 *   cascadeCount: number,
 *   genHealth: Array<{ code: string, success?: boolean, skipped?: boolean, reason?: string, error?: string }>,
 * }>}
 */
async function softDeleteAffiliateSubtree(db, targetUid, callerUid, deletedReason) {
  const targetRef = db.collection(AFFILIATE_PROFILES_COLLECTION).doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new HttpsError("not-found", "Affiliate profile not found.");
  }
  if (targetSnap.get("deletedAt") != null) {
    return {success: true, alreadyDeleted: true, cascadeCount: 0, genHealth: []};
  }

  const descendantSnap = await db.collection(AFFILIATE_PROFILES_COLLECTION)
      .where("ancestorIds", "array-contains", targetUid)
      .get();

  const cascadeUids = descendantSnap.docs
      .filter((d) => d.get("deletedAt") == null)
      .map((d) => d.id);

  const now = admin.firestore.FieldValue.serverTimestamp();
  const allProfileUpdates = [
    {
      ref: targetRef,
      data: {
        deletedAt: now,
        deletedReason: deletedReason || null,
        deletedBy: callerUid,
        deletedAncestorUid: null,
        updatedAt: now,
      },
    },
    ...cascadeUids.map((cascadeUid) => ({
      ref: db.collection(AFFILIATE_PROFILES_COLLECTION).doc(cascadeUid),
      data: {
        deletedAt: now,
        deletedReason: null,
        deletedBy: callerUid,
        deletedAncestorUid: targetUid,
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

  const affectedUids = [targetUid, ...cascadeUids];
  const ownerPromoCodes = new Set();

  for (const uid of affectedUids) {
    let more = true;
    while (more) {
      const assignSnap = await db.collection(PROMO_CODE_ASSIGNMENTS_COLLECTION)
          .where("affiliateId", "==", uid)
          .where("active", "==", true)
          .limit(BATCH_SIZE)
          .get();
      if (assignSnap.empty) {
        more = false;
        continue;
      }
      const batch = db.batch();
      for (const d of assignSnap.docs) {
        const role = d.get("role");
        const promoCodeId = String(d.get("promoCodeId") || "").trim();
        if (role === "owner" && promoCodeId) {
          ownerPromoCodes.add(promoCodeId);
        }
        batch.update(d.ref, {
          active: false,
          updatedAt: now,
        });
      }
      await batch.commit();
      if (assignSnap.size < BATCH_SIZE) more = false;
    }
  }

  /** @type {Array<{ code: string, success?: boolean, skipped?: boolean, reason?: string, error?: string }>} */
  const genHealth = [];
  for (const code of ownerPromoCodes) {
    try {
      const result = await pushPromoMirrorToGenHealth(code);
      genHealth.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn("softDeleteAffiliateSubtree: Gen-Health sync failed", {code, msg});
      genHealth.push({code, error: msg});
    }
  }

  return {
    success: true,
    cascadeCount: cascadeUids.length,
    genHealth,
  };
}

module.exports = {softDeleteAffiliateSubtree};
