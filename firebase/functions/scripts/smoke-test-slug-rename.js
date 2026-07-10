/* eslint-disable no-console, max-len, require-jsdoc */
/**
 * Smoke tests for Affiliate v2 slug rename (doc 20).
 *
 * Usage (from firebase/functions):
 *   npm run smoke:slug-rename
 */

const admin = require("firebase-admin");
const {HttpsError} = require("firebase-functions/v2/https");
const {firebaseStagingServiceAccount} = require("../config.js");
const postmark = require("../utils/postmark.js");
postmark.sendEmail = async () => {};

const pushPromoMirror = require("../lib/promo/pushPromoMirrorToGenHealth.js");
/** @type {string[]} */
const ghPushCalls = [];
const originalPushPromoMirror = pushPromoMirror.pushPromoMirrorToGenHealth;
pushPromoMirror.pushPromoMirrorToGenHealth = async (code) => {
  ghPushCalls.push(code);
  return {code, success: true};
};

const {_testHandlers: renameHandlers} = require("../endpoints/renameAffiliateSlug.js");
const {_testHandlers: lifecycleHandlers} = require("../endpoints/affiliateLifecycleV2.js");
const {normalizeUtmSlug, normalizePromoCodeId} = require("../lib/promo/normalize.js");

const PROJECT_ID = "staging-nxgenrx";
const SUPER_ADMIN_EMAIL = "abuhasan@labthree.org";
const AFFILIATE_PROFILES = "AffiliateProfiles";
const PROMO_CODE_ASSIGNMENTS = "PromoCodeAssignments";
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
  throw new Error("No active super affiliate on staging.");
}

/**
 * @param {string} superUid
 * @return {Promise<{ code: string, superUid: string } | null>}
 */
async function findSuperWithOwnerPromo(superUid) {
  const snap = await admin.firestore().collection(PROMO_CODE_ASSIGNMENTS)
      .where("affiliateId", "==", superUid)
      .where("active", "==", true)
      .where("role", "==", "owner")
      .limit(3)
      .get();
  for (const d of snap.docs) {
    const code = normalizePromoCodeId(String(d.get("promoCodeId") || ""));
    if (code) return {code, superUid};
  }
  return null;
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
  const superUid = await findActiveSuperUid();
  const runId = Date.now().toString(36);

  let subUid = "";
  let deletedSubUid = "";
  const subSlug = normalizeUtmSlug(`smoke-slug-sub-${runId}`);
  const sub2Slug = normalizeUtmSlug(`smoke-slug-sub2-${runId}`);
  const newSuperSlug = normalizeUtmSlug(`smoke-slug-super-${runId}`);
  let superSlugBefore = "";

  console.log("S1-S2 setup: Super + Sub under Super");
  await test("S1 find active Super on staging", async () => {
    const prof = await admin.firestore().collection(AFFILIATE_PROFILES).doc(superUid).get();
    if (!prof.exists || prof.get("tier") !== "super") {
      throw new Error("expected active super profile");
    }
    superSlugBefore = normalizeUtmSlug(prof.get("utmSlug"));
    if (!superSlugBefore) throw new Error("super must have utmSlug");
  });

  await test("S2 admin creates Sub under Super", async () => {
    const out = await lifecycleHandlers.handleCreateDescendantAffiliate({
      auth: {uid: adminUid, token: {}},
      data: {
        email: `smoke-slug-sub-${runId}@labthree.org`,
        displayName: `Slug Sub ${runId}`,
        utmSlug: subSlug,
        commissionRate: 10,
        parentAffiliateId: superUid,
      },
    });
    subUid = out.uid;
    const prof = await admin.firestore().collection(AFFILIATE_PROFILES).doc(subUid).get();
    if (prof.get("parentUtmSlug") !== superSlugBefore) {
      throw new Error(`expected parentUtmSlug=${superSlugBefore} got ${prof.get("parentUtmSlug")}`);
    }
  });

  console.log("\nS3 rename Super slug cascades Sub parentUtmSlug");
  await test("S3 admin renames Super slug", async () => {
    ghPushCalls.length = 0;
    const out = await renameHandlers.handleRenameAffiliateSlug({
      auth: {uid: adminUid, token: {}},
      data: {targetUid: superUid, newUtmSlug: newSuperSlug},
    });
    if (!out.success) throw new Error("rename failed");
    if (out.oldUtmSlug !== superSlugBefore) {
      throw new Error(`oldUtmSlug expected ${superSlugBefore} got ${out.oldUtmSlug}`);
    }
    if (out.newUtmSlug !== newSuperSlug) throw new Error("newUtmSlug mismatch");
    if (out.directChildrenUpdated < 1) {
      throw new Error("expected at least one direct child updated");
    }
    const subProf = await admin.firestore().collection(AFFILIATE_PROFILES).doc(subUid).get();
    if (subProf.get("parentUtmSlug") !== newSuperSlug) {
      throw new Error("sub parentUtmSlug should match new super slug");
    }
    const superProf = await admin.firestore().collection(AFFILIATE_PROFILES).doc(superUid).get();
    if (superProf.get("utmSlug") !== newSuperSlug) throw new Error("super utmSlug not updated");
    if (superProf.get("previousUtmSlug") !== superSlugBefore) {
      throw new Error("super previousUtmSlug not set");
    }
    const auditSnap = await admin.firestore().collection(AFFILIATE_PROFILES)
        .doc(superUid)
        .collection("AuditLog")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
    if (auditSnap.empty || auditSnap.docs[0].get("event") !== "slug_renamed") {
      throw new Error("expected slug_renamed audit log");
    }
  });

  console.log("\nS4 idempotent rename");
  await test("S4 same slug returns alreadyCurrent", async () => {
    const out = await renameHandlers.handleRenameAffiliateSlug({
      auth: {uid: adminUid, token: {}},
      data: {targetUid: superUid, newUtmSlug: newSuperSlug},
    });
    if (!out.alreadyCurrent) throw new Error("expected alreadyCurrent");
    if (out.directChildrenUpdated !== 0) throw new Error("expected no child updates");
  });

  console.log("\nS5 uniqueness");
  await test("S5 setup second Sub with taken slug", async () => {
    const out = await lifecycleHandlers.handleCreateDescendantAffiliate({
      auth: {uid: adminUid, token: {}},
      data: {
        email: `smoke-slug-sub2-${runId}@labthree.org`,
        displayName: `Slug Sub2 ${runId}`,
        utmSlug: sub2Slug,
        commissionRate: 10,
        parentAffiliateId: superUid,
      },
    });
    if (!out.uid) throw new Error("sub2 create failed");
  });

  await test("S5 rename to existing slug fails", async () => {
    const err = await expectError(() =>
      renameHandlers.handleRenameAffiliateSlug({
        auth: {uid: adminUid, token: {}},
        data: {targetUid: subUid, newUtmSlug: sub2Slug},
      }),
    );
    if (err.code !== "already-exists") {
      throw new Error(`expected already-exists got ${err.code}`);
    }
  });

  console.log("\nS6 deleted affiliate");
  await test("S6 setup soft-deleted Sub", async () => {
    const out = await lifecycleHandlers.handleCreateDescendantAffiliate({
      auth: {uid: adminUid, token: {}},
      data: {
        email: `smoke-slug-del-${runId}@labthree.org`,
        displayName: `Slug Del ${runId}`,
        utmSlug: normalizeUtmSlug(`smoke-slug-del-${runId}`),
        commissionRate: 10,
        parentAffiliateId: superUid,
      },
    });
    deletedSubUid = out.uid;
    await lifecycleHandlers.handleSoftDeleteAffiliate({
      auth: {uid: adminUid, token: {}},
      data: {targetUid: deletedSubUid},
    });
  });

  await test("S6 cannot rename deleted affiliate", async () => {
    const err = await expectError(() =>
      renameHandlers.handleRenameAffiliateSlug({
        auth: {uid: adminUid, token: {}},
        data: {targetUid: deletedSubUid, newUtmSlug: normalizeUtmSlug(`smoke-slug-new-${runId}`)},
      }),
    );
    if (err.code !== "failed-precondition") {
      throw new Error(`expected failed-precondition got ${err.code}`);
    }
  });

  console.log("\nS7 affiliate cannot rename");
  await test("S7 affiliate caller denied", async () => {
    const err = await expectError(() =>
      renameHandlers.handleRenameAffiliateSlug({
        auth: {uid: superUid, token: {}},
        data: {targetUid: subUid, newUtmSlug: normalizeUtmSlug(`smoke-slug-aff-${runId}`)},
      }),
    );
    if (err.code !== "permission-denied") {
      throw new Error(`expected permission-denied got ${err.code}`);
    }
  });

  console.log("\nS8 invalid slug");
  await test("S8 invalid slug format", async () => {
    const err = await expectError(() =>
      renameHandlers.handleRenameAffiliateSlug({
        auth: {uid: adminUid, token: {}},
        data: {targetUid: subUid, newUtmSlug: "x"},
      }),
    );
    if (err.code !== "invalid-argument") {
      throw new Error(`expected invalid-argument got ${err.code}`);
    }
  });

  console.log("\nS9 Gen-Health results array");
  await test("S9 genHealth results array", async () => {
    ghPushCalls.length = 0;
    const ownerPromo = await findSuperWithOwnerPromo(superUid);
    if (!ownerPromo) {
      const subOnlySlug = normalizeUtmSlug(`smoke-slug-s9-sub-${runId}`);
      const out = await renameHandlers.handleRenameAffiliateSlug({
        auth: {uid: adminUid, token: {}},
        data: {targetUid: subUid, newUtmSlug: subOnlySlug},
      });
      if (!Array.isArray(out.genHealth)) throw new Error("genHealth must be an array");
      if (out.genHealth.length !== 0) throw new Error("sub rename should have empty genHealth");
      if (ghPushCalls.length !== 0) throw new Error("no GH push expected for sub without owner promos");
      return;
    }
    const retrySlug = normalizeUtmSlug(`smoke-slug-gh-${runId}`);
    const out = await renameHandlers.handleRenameAffiliateSlug({
      auth: {uid: adminUid, token: {}},
      data: {targetUid: superUid, newUtmSlug: retrySlug},
    });
    if (!out.success) throw new Error("rename failed");
    if (!Array.isArray(out.genHealth)) throw new Error("genHealth must be an array");
    if (out.genHealth.length === 0) {
      throw new Error("expected genHealth entries for owner promos");
    }
    const codes = out.genHealth.map((r) => String(r.code || ""));
    if (!codes.includes(ownerPromo.code)) {
      throw new Error(`expected genHealth to include ${ownerPromo.code}`);
    }
    if (!ghPushCalls.includes(ownerPromo.code)) {
      throw new Error("pushPromoMirrorToGenHealth should have been called");
    }
    await renameHandlers.handleRenameAffiliateSlug({
      auth: {uid: adminUid, token: {}},
      data: {targetUid: superUid, newUtmSlug: newSuperSlug},
    });
  });

  pushPromoMirror.pushPromoMirrorToGenHealth = originalPushPromoMirror;

  if (superSlugBefore && superUid) {
    try {
      const current = await admin.firestore().collection(AFFILIATE_PROFILES).doc(superUid).get();
      const currentSlug = normalizeUtmSlug(current.get("utmSlug"));
      if (currentSlug !== superSlugBefore) {
        await renameHandlers.handleRenameAffiliateSlug({
          auth: {uid: adminUid, token: {}},
          data: {targetUid: superUid, newUtmSlug: superSlugBefore},
        });
        console.log(`\nTeardown: restored Super slug to ${superSlugBefore}`);
      }
    } catch (teardownErr) {
      const msg = teardownErr instanceof Error ? teardownErr.message : String(teardownErr);
      console.warn(`\nTeardown warning: could not restore Super slug: ${msg}`);
    }
  }

  console.log(`\nDone. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
