/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const {HttpsError} = require("firebase-functions/v2/https");
const {db} = require("../../utils/Firebase.js");
const {deleteAffiliateCascadeSingle} = require("./deleteAffiliateCascade.js");
const {pushPromoMirrorToGenHealth} = require("../promo/pushPromoMirrorToGenHealth.js");

const AFFILIATE_PROFILES_COLLECTION = "AffiliateProfiles";
const USERS_COLLECTION = "Users";
const AFFILIATE_ROLE = "affiliate";

/**
 * @param {string} targetUid
 * @return {Promise<Array<{ id: string, depth: number, parentAffiliateId: string | null }>>}
 */
async function collectSubtreeProfiles(targetUid) {
  const targetSnap = await db.collection(AFFILIATE_PROFILES_COLLECTION).doc(targetUid).get();
  if (!targetSnap.exists) {
    throw new HttpsError("not-found", "Affiliate profile not found.");
  }

  const nodes = [{
    id: targetUid,
    depth: Number(targetSnap.get("depth")) || 1,
    parentAffiliateId: targetSnap.get("parentAffiliateId") || null,
  }];

  const descendantSnap = await db.collection(AFFILIATE_PROFILES_COLLECTION)
      .where("ancestorIds", "array-contains", targetUid)
      .get();

  for (const d of descendantSnap.docs) {
    nodes.push({
      id: d.id,
      depth: Number(d.get("depth")) || 1,
      parentAffiliateId: d.get("parentAffiliateId") || null,
    });
  }

  return nodes;
}

/**
 * @param {string} targetUid
 * @param {boolean} acknowledgeUnpaidCommission
 * @return {Promise<{
 *   success: boolean,
 *   deletedCount: number,
 *   genHealth: Array<Record<string, unknown>>,
 * }>}
 */
async function hardDeleteAffiliateTree(targetUid, acknowledgeUnpaidCommission) {
  const userSnap = await db.collection(USERS_COLLECTION).doc(targetUid).get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "Affiliate not found.");
  }
  if (userSnap.get("role") !== AFFILIATE_ROLE) {
    throw new HttpsError("failed-precondition", "User is not an affiliate.");
  }

  const subtree = await collectSubtreeProfiles(targetUid);
  const subtreeUids = subtree.map((n) => n.id);

  let unpaidTotalCents = 0;
  /** @type {Array<{ uid: string, orderId: string, commissionCents: number }>} */
  const breakdown = [];

  for (const uid of subtreeUids) {
    const ordersSnap = await db.collection(AFFILIATE_PROFILES_COLLECTION)
        .doc(uid)
        .collection("Orders")
        .where("commissionPaid", "==", false)
        .get();
    for (const orderDoc of ordersSnap.docs) {
      const cents = orderDoc.get("commissionCents");
      if (typeof cents === "number" && cents > 0) {
        unpaidTotalCents += cents;
        breakdown.push({uid, orderId: orderDoc.id, commissionCents: cents});
      }
    }
  }

  if (unpaidTotalCents > 0 && !acknowledgeUnpaidCommission) {
    throw new HttpsError(
        "failed-precondition",
        "Subtree has unpaid commission. Pay out or pass acknowledgeUnpaidCommission.",
        {unpaidTotalCents, breakdown},
    );
  }

  subtree.sort((a, b) => b.depth - a.depth);

  const ownerPromoCodes = new Set();
  const parentIds = new Set();

  for (const node of subtree) {
    if (node.parentAffiliateId) parentIds.add(node.parentAffiliateId);
    const {ownerPromoCodes: codes} = await deleteAffiliateCascadeSingle(node.id);
    for (const c of codes) ownerPromoCodes.add(c);
  }

  for (const parentId of parentIds) {
    const parentRef = db.collection(AFFILIATE_PROFILES_COLLECTION).doc(parentId);
    const parentSnap = await parentRef.get();
    if (!parentSnap.exists) continue;
    const activeChildren = await db.collection(AFFILIATE_PROFILES_COLLECTION)
        .where("parentAffiliateId", "==", parentId)
        .get();
    await parentRef.update({
      childCount: activeChildren.size,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  /** @type {Array<Record<string, unknown>>} */
  const genHealth = [];
  for (const code of ownerPromoCodes) {
    try {
      genHealth.push(await pushPromoMirrorToGenHealth(code));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn("hardDeleteAffiliateTree: Gen-Health sync failed", {code, msg});
      genHealth.push({code, error: msg});
    }
  }

  return {
    success: true,
    deletedCount: subtree.length,
    genHealth,
  };
}

module.exports = {hardDeleteAffiliateTree, collectSubtreeProfiles};
