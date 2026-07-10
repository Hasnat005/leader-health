/* eslint-disable no-console, max-len, require-jsdoc */
/**
 * Smoke tests for Affiliate v2 promo assignment (doc 19).
 *
 * Usage (from firebase/functions):
 *   npm run smoke:promo-assignment-v2
 */

const admin = require("firebase-admin");
const {HttpsError} = require("firebase-functions/v2/https");
const {firebaseStagingServiceAccount} = require("../config.js");
const postmark = require("../utils/postmark.js");
postmark.sendEmail = async () => {};
const {_testHandlers} = require("../endpoints/affiliatePromoV2.js");
const {_testHandlers: lifecycleHandlers} = require("../endpoints/affiliateLifecycleV2.js");
const {
  reconcileAssignments,
  cascadeRevokeAfterOwnerRemoval,
} = require("../lib/promo/reconcileAssignments.js");
const {
  listActiveAssigneeIdsForPromo,
  listActiveOwnerAssigneeIdsForPromo,
} = require("../lib/promo/pushPromoMirrorToGenHealth.js");
const {normalizePromoCodeId, promoAssignmentDocId} = require("../lib/promo/normalize.js");

const PROJECT_ID = "staging-nxgenrx";
const SUPER_ADMIN_EMAIL = "abuhasan@labthree.org";
const AFFILIATE_PROFILES = "AffiliateProfiles";
const PROMO_CODE_ASSIGNMENTS = "PromoCodeAssignments";
const PROMO_CODES = "PromoCodes";
const USERS = "Users";
let passed = 0;
let failed = 0;

/**
 * @param {string} name
 * @param {function(): Promise<void>} fn
 * @return {Promise<void>}
 */
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  FAIL ${name}: ${msg}`);
  }
}

/**
 * @param {function(): Promise<void>} fn
 * @return {Promise<HttpsError>}
 */
async function expectError(fn) {
  try {
    await fn();
    throw new Error("Expected HttpsError but call succeeded");
  } catch (err) {
    if (err instanceof HttpsError) return err;
    if (err instanceof Error && err.message === "Expected HttpsError but call succeeded") throw err;
    throw err;
  }
}

/**
 * @return {Promise<string>}
 */
async function resolveSuperAdminUid() {
  const user = await admin.auth().getUserByEmail(SUPER_ADMIN_EMAIL);
  return user.uid;
}

/**
 * @param {string} uid
 * @param {string} label
 * @return {Promise<void>}
 */
async function requireAffiliateDashboardUser(uid, label) {
  const snap = await admin.firestore().collection(USERS).doc(uid).get();
  if (!snap.exists || snap.get("role") !== "affiliate") {
    throw new Error(
        `${label} (${uid}) needs Users/{uid}.role === "affiliate" for affiliate-as-caller smoke`,
    );
  }
}

/**
 * @param {string} code
 * @param {string} uid
 * @return {Promise<boolean>}
 */
async function isAssignmentActive(code, uid) {
  const snap = await admin.firestore().collection(PROMO_CODE_ASSIGNMENTS)
      .doc(promoAssignmentDocId(code, uid))
      .get();
  return snap.exists && snap.get("active") !== false;
}

/**
 * @return {Promise<{ code: string, superUid: string }>}
 */
async function findSuperWithActivePromo() {
  const supers = await admin.firestore().collection(AFFILIATE_PROFILES)
      .where("tier", "==", "super")
      .get();
  for (const superDoc of supers.docs) {
    if (superDoc.get("paused") === true) continue;
    if (superDoc.get("deletedAt") != null) continue;
    const snap = await admin.firestore().collection(PROMO_CODE_ASSIGNMENTS)
        .where("affiliateId", "==", superDoc.id)
        .where("active", "==", true)
        .limit(5)
        .get();
    for (const d of snap.docs) {
      const code = normalizePromoCodeId(String(d.get("promoCodeId") || ""));
      if (!code) continue;
      const promoSnap = await admin.firestore().collection(PROMO_CODES).doc(code).get();
      if (!promoSnap.exists || promoSnap.get("archived") === true) continue;
      return {code, superUid: superDoc.id};
    }
  }
  throw new Error("No active super with a promo assignment on staging — assign a promo to a Super first.");
}

/**
 * @param {string} code
 * @param {string} superUid
 * @param {string} adminUid
 * @return {Promise<void>}
 */
async function seedDotfitOwnerPromo(code, superUid, adminUid) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  await admin.firestore().collection(PROMO_CODES).doc(code).set(
      {
        catalogProvider: "dotfit",
        state: "shared",
        archived: false,
        usageCount: 0,
        assignedAffiliateIds: [superUid],
        affiliatesSnapshot: [],
        validity: {startsAt: null, endsAt: null},
        updatedAt: now,
      },
      {merge: true},
  );
  const promoSnap = await admin.firestore().collection(PROMO_CODES).doc(code).get();
  const {batch} = await reconcileAssignments(code, "shared", [superUid], promoSnap, adminUid);
  await batch.commit();
}

/**
 * @param {string} code
 * @param {string} superUid
 * @param {string} adminUid
 * @return {Promise<void>}
 */
async function removeOwnerAndCascade(code, superUid, adminUid) {
  const promoSnap = await admin.firestore().collection(PROMO_CODES).doc(code).get();
  const {batch, removedIds} = await reconcileAssignments(code, "shared", [], promoSnap, adminUid);
  await batch.commit();
  if (removedIds.includes(superUid)) {
    await cascadeRevokeAfterOwnerRemoval(code, removedIds);
  }
}

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseStagingServiceAccount),
      projectId: PROJECT_ID,
    });
  }

  console.log(`Project: ${PROJECT_ID}\n`);

  const adminUid = await resolveSuperAdminUid();
  const {code: promoCode, superUid} = await findSuperWithActivePromo();
  await requireAffiliateDashboardUser(superUid, "Super owner");

  const runId = Date.now().toString(36);
  let subUid = "";
  let microUid = "";
  let sub2Uid = "";
  let sub2MicroUid = "";

  console.log("T8 promo assignment (setup: create Sub + Micro)");
  await test("setup create Sub under Super", async () => {
    const out = await lifecycleHandlers.handleCreateDescendantAffiliate({
      auth: {uid: adminUid, token: {}},
      data: {
        email: `smoke-promo-sub-${runId}@labthree.org`,
        displayName: `Promo Sub ${runId}`,
        utmSlug: `smoke-promo-sub-${runId}`,
        commissionRate: 10,
        parentAffiliateId: superUid,
      },
    });
    subUid = out.uid;
  });

  await test("setup assign promo to Sub then Micro", async () => {
    await _testHandlers.handleAssignPromoToDescendant({
      auth: {uid: adminUid, token: {}},
      data: {targetUid: subUid, promoCodeId: promoCode},
    });
    const out = await lifecycleHandlers.handleCreateDescendantAffiliate({
      auth: {uid: adminUid, token: {}},
      data: {
        email: `smoke-promo-micro-${runId}@labthree.org`,
        displayName: `Promo Micro ${runId}`,
        utmSlug: `smoke-promo-micro-${runId}`,
        commissionRate: 5,
        parentAffiliateId: subUid,
        assignedPromoCodes: [promoCode],
      },
    });
    microUid = out.uid;
    const assignSnap = await admin.firestore().collection(PROMO_CODE_ASSIGNMENTS)
        .doc(promoAssignmentDocId(promoCode, microUid))
        .get();
    if (!assignSnap.exists || assignSnap.get("active") === false) {
      throw new Error("micro should have promo from create flow");
    }
    if (assignSnap.get("role") !== "descendant") {
      throw new Error(`expected role descendant got ${assignSnap.get("role")}`);
    }
  });

  console.log("\nT8 assignPromoToDescendantCallable");
  await test("setup second Sub with promo and Micro", async () => {
    const out = await lifecycleHandlers.handleCreateDescendantAffiliate({
      auth: {uid: adminUid, token: {}},
      data: {
        email: `smoke-promo-sub2-${runId}@labthree.org`,
        displayName: `Promo Sub2 ${runId}`,
        utmSlug: `smoke-promo-sub2-${runId}`,
        commissionRate: 10,
        parentAffiliateId: superUid,
      },
    });
    sub2Uid = out.uid;
    await _testHandlers.handleAssignPromoToDescendant({
      auth: {uid: adminUid, token: {}},
      data: {targetUid: sub2Uid, promoCodeId: promoCode},
    });
    const microOut = await lifecycleHandlers.handleCreateDescendantAffiliate({
      auth: {uid: adminUid, token: {}},
      data: {
        email: `smoke-promo-sub2-micro-${runId}@labthree.org`,
        displayName: `Promo Sub2 Micro ${runId}`,
        utmSlug: `smoke-promo-sub2-micro-${runId}`,
        commissionRate: 5,
        parentAffiliateId: sub2Uid,
        assignedPromoCodes: [promoCode],
      },
    });
    sub2MicroUid = microOut.uid;
    if (!await isAssignmentActive(promoCode, sub2Uid)) {
      throw new Error("sub2 assignment should be active");
    }
    if (!await isAssignmentActive(promoCode, sub2MicroUid)) {
      throw new Error("sub2 micro assignment should be active");
    }
  });

  await test("8a admin assigns promo to Sub (idempotent on sub2)", async () => {
    const out = await _testHandlers.handleAssignPromoToDescendant({
      auth: {uid: adminUid, token: {}},
      data: {targetUid: sub2Uid, promoCodeId: promoCode},
    });
    if (!out.alreadyAssigned) throw new Error("expected alreadyAssigned for sub2");
    const snap = await admin.firestore().collection(PROMO_CODE_ASSIGNMENTS)
        .doc(promoAssignmentDocId(promoCode, sub2Uid))
        .get();
    if (snap.get("role") !== "descendant") throw new Error("expected descendant role");
  });

  await test("8b idempotent assign on fresh Sub branch", async () => {
    const out = await _testHandlers.handleAssignPromoToDescendant({
      auth: {uid: adminUid, token: {}},
      data: {targetUid: sub2Uid, promoCodeId: promoCode},
    });
    if (!out.alreadyAssigned) throw new Error("expected alreadyAssigned");
  });

  await test("8e non-parent cannot assign", async () => {
    const err = await expectError(() =>
      _testHandlers.handleAssignPromoToDescendant({
        auth: {uid: sub2Uid, token: {}},
        data: {targetUid: microUid, promoCodeId: promoCode},
      }),
    );
    if (err.code !== "permission-denied") {
      throw new Error(`expected permission-denied got ${err.code}`);
    }
  });

  console.log("\nT8 owner-only Gen-Health list");
  await test("8f listActiveOwnerAssigneeIdsForPromo is owner-only", async () => {
    const allIds = await listActiveAssigneeIdsForPromo(promoCode);
    const ownerIds = await listActiveOwnerAssigneeIdsForPromo(promoCode);
    if (ownerIds.length === 0) throw new Error("expected at least one owner");
    if (allIds.length <= ownerIds.length) {
      throw new Error("expected active descendants in addition to owner(s)");
    }
    for (const oid of ownerIds) {
      if (!allIds.includes(oid)) throw new Error("owner id missing from all assignees");
    }
    const ownerSnap = await admin.firestore().collection(PROMO_CODE_ASSIGNMENTS)
        .where("promoCodeId", "==", promoCode)
        .where("active", "==", true)
        .where("role", "==", "owner")
        .get();
    if (ownerSnap.size !== ownerIds.length) {
      throw new Error("owner list length mismatch");
    }
  });

  console.log("\nT8 revokePromoFromDescendantCallable");
  await test("8c-pre sibling Sub and Micro still active before revoke", async () => {
    if (!await isAssignmentActive(promoCode, sub2Uid)) {
      throw new Error("sub2 should still be active before revoking sub1");
    }
    if (!await isAssignmentActive(promoCode, sub2MicroUid)) {
      throw new Error("sub2 micro should still be active before revoking sub1");
    }
  });

  await test("8c Super revokes Sub assignment cascades Micro", async () => {
    const out = await _testHandlers.handleRevokePromoFromDescendant({
      auth: {uid: superUid, token: {}},
      data: {targetUid: subUid, promoCodeId: promoCode},
    });
    if (!out.success) throw new Error("revoke failed");
    if (await isAssignmentActive(promoCode, subUid)) {
      throw new Error("sub assignment still active");
    }
    if (await isAssignmentActive(promoCode, microUid)) {
      throw new Error("micro should be cascade-revoked");
    }
  });

  await test("8c-sibling other Sub and Micro unchanged after revoke", async () => {
    if (!await isAssignmentActive(promoCode, sub2Uid)) {
      throw new Error("sub2 should remain active when only sub1 was revoked");
    }
    if (!await isAssignmentActive(promoCode, sub2MicroUid)) {
      throw new Error("sub2 micro should remain active when only sub1 was revoked");
    }
  });

  await test("8h Sub revokes Micro assignment", async () => {
    await requireAffiliateDashboardUser(sub2Uid, "Sub parent");
    const out = await _testHandlers.handleRevokePromoFromDescendant({
      auth: {uid: sub2Uid, token: {}},
      data: {targetUid: sub2MicroUid, promoCodeId: promoCode},
    });
    if (!out.success) throw new Error("sub revoke micro failed");
    if (await isAssignmentActive(promoCode, sub2MicroUid)) {
      throw new Error("micro should be revoked by Sub");
    }
    if (!await isAssignmentActive(promoCode, sub2Uid)) {
      throw new Error("sub2 should still hold promo after revoking only its Micro");
    }
  });

  await test("8d idempotent revoke", async () => {
    const out = await _testHandlers.handleRevokePromoFromDescendant({
      auth: {uid: superUid, token: {}},
      data: {targetUid: subUid, promoCodeId: promoCode},
    });
    if (!out.alreadyRevoked) throw new Error("expected alreadyRevoked");
  });

  console.log("\nT8 owner removal cascade (reconcileAssignments + cascade)");
  const ownerCascadeCode = normalizePromoCodeId(`SMOKEOWN${runId}`);
  let ocSubA = "";
  let ocSubB = "";
  let ocMicroA = "";
  let ocMicroB = "";

  await test("8g setup isolated dotfit promo with owner tree", async () => {
    await seedDotfitOwnerPromo(ownerCascadeCode, superUid, adminUid);
    if (!await isAssignmentActive(ownerCascadeCode, superUid)) {
      throw new Error("super owner assignment missing");
    }

    const subAOut = await lifecycleHandlers.handleCreateDescendantAffiliate({
      auth: {uid: adminUid, token: {}},
      data: {
        email: `smoke-ownc-suba-${runId}@labthree.org`,
        displayName: `OwnerCascade SubA ${runId}`,
        utmSlug: `smoke-ownc-suba-${runId}`,
        commissionRate: 10,
        parentAffiliateId: superUid,
      },
    });
    ocSubA = subAOut.uid;
    await _testHandlers.handleAssignPromoToDescendant({
      auth: {uid: superUid, token: {}},
      data: {targetUid: ocSubA, promoCodeId: ownerCascadeCode},
    });

    const microAOut = await lifecycleHandlers.handleCreateDescendantAffiliate({
      auth: {uid: adminUid, token: {}},
      data: {
        email: `smoke-ownc-microa-${runId}@labthree.org`,
        displayName: `OwnerCascade MicroA ${runId}`,
        utmSlug: `smoke-ownc-microa-${runId}`,
        commissionRate: 5,
        parentAffiliateId: ocSubA,
        assignedPromoCodes: [ownerCascadeCode],
      },
    });
    ocMicroA = microAOut.uid;

    const subBOut = await lifecycleHandlers.handleCreateDescendantAffiliate({
      auth: {uid: adminUid, token: {}},
      data: {
        email: `smoke-ownc-subb-${runId}@labthree.org`,
        displayName: `OwnerCascade SubB ${runId}`,
        utmSlug: `smoke-ownc-subb-${runId}`,
        commissionRate: 10,
        parentAffiliateId: superUid,
      },
    });
    ocSubB = subBOut.uid;
    await _testHandlers.handleAssignPromoToDescendant({
      auth: {uid: superUid, token: {}},
      data: {targetUid: ocSubB, promoCodeId: ownerCascadeCode},
    });

    const microBOut = await lifecycleHandlers.handleCreateDescendantAffiliate({
      auth: {uid: adminUid, token: {}},
      data: {
        email: `smoke-ownc-microb-${runId}@labthree.org`,
        displayName: `OwnerCascade MicroB ${runId}`,
        utmSlug: `smoke-ownc-microb-${runId}`,
        commissionRate: 5,
        parentAffiliateId: ocSubB,
        assignedPromoCodes: [ownerCascadeCode],
      },
    });
    ocMicroB = microBOut.uid;

    for (const uid of [ocSubA, ocSubB, ocMicroA, ocMicroB]) {
      if (!await isAssignmentActive(ownerCascadeCode, uid)) {
        throw new Error(`expected active assignment for ${uid}`);
      }
    }
  });

  await test("8g admin removes Super owner cascades all Subs and Micros", async () => {
    await removeOwnerAndCascade(ownerCascadeCode, superUid, adminUid);
    for (const uid of [superUid, ocSubA, ocSubB, ocMicroA, ocMicroB]) {
      if (await isAssignmentActive(ownerCascadeCode, uid)) {
        throw new Error(`assignment still active for ${uid} after owner removal`);
      }
    }
  });

  console.log(`\nDone. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
