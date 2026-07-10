/* eslint-disable require-jsdoc, max-len */

/**
 * One-time backfill: adds Affiliate Program v2 hierarchy fields to every
 * existing AffiliateProfiles document (all legacy affiliates become Supers).
 *
 * Run from `firebase/functions`:
 *   node scripts/backfill-affiliate-v2-profiles.js
 *   node scripts/backfill-affiliate-v2-profiles.js --dry-run
 *
 * or via npm:
 *   npm run backfill:affiliate-v2-profiles
 *
 * Targets staging-nxgenrx via firebaseStagingServiceAccount in config.js.
 *
 * Safe to re-run — skips docs where `tier` is already set.
 */

const admin = require("firebase-admin");
const {firebaseStagingServiceAccount} = require("../config.js");

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_MAX = 499;
const VALID_TIERS = new Set(["super", "sub", "micro"]);

/**
 * @param {FirebaseFirestore.DocumentSnapshot} doc
 * @return {Record<string, unknown>}
 */
function buildSuperMigrationPatch(doc) {
  const uid = doc.id;
  return {
    tier: "super",
    depth: 1,
    parentAffiliateId: null,
    parentUtmSlug: null,
    ancestorIds: [],
    rootSuperAffiliateId: uid,
    childCount: 0,
    deletedAt: null,
    deletedReason: null,
    deletedBy: null,
    deletedAncestorUid: null,
    previousUtmSlug: null,
    createdByUid: "system_migration",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function main() {
  const projectId = firebaseStagingServiceAccount.project_id;
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseStagingServiceAccount),
      projectId,
    });
  }
  const db = admin.firestore();

  console.log(`Project: ${projectId}`);
  if (DRY_RUN) {
    console.log("DRY RUN — no writes will be committed.\n");
  }

  const snap = await db.collection("AffiliateProfiles").get();
  console.log(`Found ${snap.size} AffiliateProfiles document(s).`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const existingTier = data.tier;
    if (typeof existingTier === "string" && VALID_TIERS.has(existingTier)) {
      console.log(`[SKIP] AffiliateProfiles/${doc.id} — tier already set (${existingTier})`);
      skipped++;
      continue;
    }

    const patch = buildSuperMigrationPatch(doc);
    console.log(
        `[UPDATE] AffiliateProfiles/${doc.id} tier=super depth=1 rootSuperAffiliateId=${doc.id}`,
    );

    if (!DRY_RUN) {
      batch.update(doc.ref, patch);
      batchCount++;
      updated++;

      if (batchCount >= BATCH_MAX) {
        await batch.commit();
        console.log(`Flushed batch of ${batchCount} updates.`);
        batchCount = 0;
        batch = db.batch();
      }
    } else {
      updated++;
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    try {
      await batch.commit();
      console.log(`Flushed batch of ${batchCount} updates.`);
    } catch (err) {
      console.error("Final batch commit failed:", err);
      errors++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}.`);
  if (DRY_RUN) {
    console.log("(dry-run — no documents were written)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
