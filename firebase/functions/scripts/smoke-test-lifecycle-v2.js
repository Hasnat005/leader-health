/* eslint-disable no-console, max-len, require-jsdoc */
/**
 * Smoke tests for Affiliate v2 lifecycle callables (doc 18).
 *
 * Invokes handler functions directly (no UI / no deploy required).
 * Targets staging-nxgenrx via firebaseStagingServiceAccount.
 *
 * Usage (from firebase/functions):
 *   node scripts/smoke-test-lifecycle-v2.js
 *
 * Optional — also hit deployed Cloud Functions (after deploy):
 *   SMOKE_REMOTE=1 FIREBASE_WEB_API_KEY=... node scripts/smoke-test-lifecycle-v2.js
 */

const admin = require("firebase-admin");
const {HttpsError} = require("firebase-functions/v2/https");
const {firebaseStagingServiceAccount} = require("../config.js");
// Stub Postmark before lifecycle module loads (handlers bind sendEmail at require time).
const postmark = require("../utils/postmark.js");
postmark.sendEmail = async () => {};
const {_testHandlers} = require("../endpoints/affiliateLifecycleV2.js");
const {normalizeUtmSlug} = require("../lib/promo/normalize.js");

const PROJECT_ID = "staging-nxgenrx";
const SUPER_ADMIN_EMAIL = "abuhasan@labthree.org";
const AFFILIATE_PROFILES = "AffiliateProfiles";
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
    if (err instanceof HttpsError && err.details) {
      console.error("    details:", err.details);
    }
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
 * @return {Promise<string>}
 */
async function findActiveSuperUid() {
  const snap = await admin.firestore().collection(AFFILIATE_PROFILES)
      .where("tier", "==", "super")
      .get();
  for (const d of snap.docs) {
    if (d.get("paused") === true) continue;
    if (d.get("deletedAt") != null) continue;
    return d.id;
  }
  throw new Error("No active super affiliate on staging — unpause or create one.");
}

/**
 * @param {string} superUid
 * @return {Promise<void>}
 */
async function ensureSuperUnpaused(superUid) {
  await admin.firestore().collection(AFFILIATE_PROFILES).doc(superUid).update({
    paused: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
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
  const parentSuperUid = await findActiveSuperUid();

  const runId = Date.now().toString(36);
  let subUid = "";
  let microUid = "";

  try {
    console.log("T1 createDescendantAffiliateCallable");
    await test("1a admin creates Sub under Super", async () => {
      const slug = normalizeUtmSlug(`smoke-sub-${runId}`);
      const email = `smoke-sub-${runId}@labthree.org`;
      const out = await _testHandlers.handleCreateDescendantAffiliate({
        auth: {uid: adminUid, token: {}},
        data: {
          email,
          displayName: `Smoke Sub ${runId}`,
          utmSlug: slug,
          commissionRate: 10,
          parentAffiliateId: parentSuperUid,
        },
      });
      subUid = out.uid;
      const prof = await admin.firestore().collection(AFFILIATE_PROFILES).doc(subUid).get();
      if (prof.get("tier") !== "sub") throw new Error(`expected tier=sub got ${prof.get("tier")}`);
      if (prof.get("depth") !== 2) throw new Error(`expected depth=2`);
      if (prof.get("parentAffiliateId") !== parentSuperUid) {
        throw new Error("parentAffiliateId mismatch");
      }
      const ancestors = prof.get("ancestorIds") || [];
      if (!ancestors.includes(parentSuperUid)) throw new Error("ancestorIds missing super");
    });

    await test("1b admin creates Micro under Sub", async () => {
      const slug = normalizeUtmSlug(`smoke-micro-${runId}`);
      const email = `smoke-micro-${runId}@labthree.org`;
      const out = await _testHandlers.handleCreateDescendantAffiliate({
        auth: {uid: adminUid, token: {}},
        data: {
          email,
          displayName: `Smoke Micro ${runId}`,
          utmSlug: slug,
          commissionRate: 5,
          parentAffiliateId: subUid,
        },
      });
      microUid = out.uid;
      const prof = await admin.firestore().collection(AFFILIATE_PROFILES).doc(microUid).get();
      if (prof.get("tier") !== "micro") throw new Error(`expected tier=micro`);
      if (prof.get("depth") !== 3) throw new Error(`expected depth=3`);
      const ancestors = prof.get("ancestorIds") || [];
      if (!ancestors.includes(subUid) || !ancestors.includes(parentSuperUid)) {
        throw new Error("ancestorIds chain incorrect");
      }
    });

    await test("1d duplicate email", async () => {
      const err = await expectError(() =>
        _testHandlers.handleCreateDescendantAffiliate({
          auth: {uid: adminUid, token: {}},
          data: {
            email: `smoke-sub-${runId}@labthree.org`,
            displayName: "Dup",
            utmSlug: `smoke-dup-${runId}`,
            commissionRate: 10,
            parentAffiliateId: parentSuperUid,
          },
        }),
      );
      if (err.code !== "already-exists") throw new Error(`expected already-exists got ${err.code}`);
    });

    console.log("\nT2 pauseAffiliateCallable");
    await test("2a admin pauses Sub", async () => {
      const out = await _testHandlers.handlePauseAffiliate({
        auth: {uid: adminUid, token: {}},
        data: {targetUid: subUid, reason: "smoke"},
      });
      if (!out.success) throw new Error("pause failed");
      const prof = await admin.firestore().collection(AFFILIATE_PROFILES).doc(subUid).get();
      if (prof.get("paused") !== true) throw new Error("paused not set");
      const audit = await admin.firestore().collection(AFFILIATE_PROFILES).doc(subUid)
          .collection("AuditLog").limit(5).get();
      const pausedEvent = audit.docs.some((d) => d.get("event") === "paused");
      if (!pausedEvent) throw new Error("missing paused audit log");
    });

    await test("2b idempotent pause", async () => {
      const out = await _testHandlers.handlePauseAffiliate({
        auth: {uid: adminUid, token: {}},
        data: {targetUid: subUid},
      });
      if (!out.alreadyPaused) throw new Error("expected alreadyPaused");
    });

    console.log("\nT3 unpauseAffiliateCallable");
    await test("3a unpause Sub", async () => {
      await _testHandlers.handleUnpauseAffiliate({
        auth: {uid: adminUid, token: {}},
        data: {targetUid: subUid},
      });
      const prof = await admin.firestore().collection(AFFILIATE_PROFILES).doc(subUid).get();
      if (prof.get("paused") === true) throw new Error("still paused");
    });

    await test("3b cannot unpause when parent paused", async () => {
      await _testHandlers.handlePauseAffiliate({
        auth: {uid: adminUid, token: {}},
        data: {targetUid: subUid},
      });
      await _testHandlers.handlePauseAffiliate({
        auth: {uid: adminUid, token: {}},
        data: {targetUid: parentSuperUid},
      });
      const err = await expectError(() =>
        _testHandlers.handleUnpauseAffiliate({
          auth: {uid: adminUid, token: {}},
          data: {targetUid: subUid},
        }),
      );
      if (err.code !== "failed-precondition") {
        throw new Error(`expected failed-precondition got ${err.code}`);
      }
      await ensureSuperUnpaused(parentSuperUid);
      await _testHandlers.handleUnpauseAffiliate({
        auth: {uid: adminUid, token: {}},
        data: {targetUid: subUid},
      });
    });

    console.log("\nT4 softDeleteAffiliateCallable");
    await test("4a soft-delete Sub cascades Micro", async () => {
      const out = await _testHandlers.handleSoftDeleteAffiliate({
        auth: {uid: adminUid, token: {}},
        data: {targetUid: subUid, deletedReason: "smoke"},
      });
      if (!out.success) throw new Error("soft delete failed");
      const sub = await admin.firestore().collection(AFFILIATE_PROFILES).doc(subUid).get();
      const micro = await admin.firestore().collection(AFFILIATE_PROFILES).doc(microUid).get();
      if (!sub.get("deletedAt")) throw new Error("sub not deleted");
      if (!micro.get("deletedAt")) throw new Error("micro not deleted");
      if (micro.get("deletedAncestorUid") !== subUid) {
        throw new Error("micro deletedAncestorUid wrong");
      }
    });

    await test("4b idempotent soft-delete", async () => {
      const out = await _testHandlers.handleSoftDeleteAffiliate({
        auth: {uid: adminUid, token: {}},
        data: {targetUid: subUid},
      });
      if (!out.alreadyDeleted) throw new Error("expected alreadyDeleted");
    });

    await test("4c restore Micro while parent still deleted fails", async () => {
      const err = await expectError(() =>
        _testHandlers.handleRestoreAffiliate({
          auth: {uid: adminUid, token: {}},
          data: {targetUid: microUid},
        }),
      );
      if (err.code !== "failed-precondition") {
        throw new Error(`expected failed-precondition got ${err.code}`);
      }
    });

    console.log("\nT5 restoreAffiliateCallable");
    await test("5a restore Sub only (Micro stays deleted)", async () => {
      await _testHandlers.handleRestoreAffiliate({
        auth: {uid: adminUid, token: {}},
        data: {targetUid: subUid},
      });
      const sub = await admin.firestore().collection(AFFILIATE_PROFILES).doc(subUid).get();
      const micro = await admin.firestore().collection(AFFILIATE_PROFILES).doc(microUid).get();
      if (sub.get("deletedAt") != null) throw new Error("sub still deleted");
      if (micro.get("deletedAt") == null) throw new Error("micro should stay deleted");
    });

    console.log("\nT6 hardDeleteAffiliateCallable");
    await test("6b hard-delete Sub + Micro (no unpaid commission)", async () => {
      const out = await _testHandlers.handleHardDeleteAffiliate({
        auth: {uid: adminUid, token: {}},
        data: {targetUid: subUid, acknowledgeUnpaidCommission: true},
      });
      if (!out.success) throw new Error("hard delete failed");
      const sub = await admin.firestore().collection(AFFILIATE_PROFILES).doc(subUid).get();
      const micro = await admin.firestore().collection(AFFILIATE_PROFILES).doc(microUid).get();
      if (sub.exists || micro.exists) throw new Error("profiles still exist after hard delete");
      subUid = "";
      microUid = "";
    });

    console.log("\nT7 authority edge cases");
    await test("7c affiliate cannot hard-delete", async () => {
      const affiliateUid = await findActiveSuperUid();
      const err = await expectError(() =>
        _testHandlers.handleHardDeleteAffiliate({
          auth: {uid: affiliateUid, token: {}},
          data: {targetUid: parentSuperUid},
        }),
      );
      if (err.code !== "permission-denied") {
        throw new Error(`expected permission-denied got ${err.code}`);
      }
    });
  } finally {
    await ensureSuperUnpaused(parentSuperUid).catch(() => {});
  }

  console.log(`\nDone. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
