/* eslint-disable require-jsdoc, max-len */

/**
 * One-time backfill: adds Affiliate Program v2 fields to every PromoCodeAssignments
 * document (all legacy rows become role: 'owner').
 *
 * Run AFTER backfill-affiliate-v2-profiles.js.
 *
 * Run from `firebase/functions`:
 *   node scripts/backfill-affiliate-v2-assignments.js
 *   node scripts/backfill-affiliate-v2-assignments.js --dry-run
 *
 * or via npm:
 *   npm run backfill:affiliate-v2-assignments
 *
 * Targets staging-nxgenrx via firebaseStagingServiceAccount in config.js.
 *
 * Safe to re-run — skips docs where `role` is already set.
 */

const admin = require("firebase-admin");
const {firebaseStagingServiceAccount} = require("../config.js");

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_MAX = 499;
const PAGE_SIZE = 500;
const VALID_ROLES = new Set(["owner", "descendant"]);

/**
 * @param {FirebaseFirestore.DocumentData} data
 * @return {Record<string, unknown>}
 */
function buildOwnerMigrationPatch(data) {
  const affiliateId = String(data.affiliateId || "").trim();
  const assignedAt =
    data.createdAt != null ?
      data.createdAt :
      admin.firestore.FieldValue.serverTimestamp();

  return {
    role: "owner",
    rootSuperAffiliateId: affiliateId,
    parentAssignmentId: null,
    assignedByUid: "system_migration",
    assignedAt,
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

  let updated = 0;
  let skipped = 0;
  let warned = 0;
  let errors = 0;

  let batch = db.batch();
  let batchCount = 0;

  let lastDoc = null;
  let hasMore = true;

  while (hasMore) {
    let query = db.collection("PromoCodeAssignments").limit(PAGE_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const page = await query.get();
    if (page.empty) {
      hasMore = false;
      break;
    }

    for (const doc of page.docs) {
      const data = doc.data();
      const existingRole = data.role;
      if (typeof existingRole === "string" && VALID_ROLES.has(existingRole)) {
        console.log(`[SKIP] PromoCodeAssignments/${doc.id} — role already set (${existingRole})`);
        skipped++;
        continue;
      }

      const affiliateId = String(data.affiliateId || "").trim();
      if (!affiliateId) {
        console.warn(`[WARN] PromoCodeAssignments/${doc.id} — missing affiliateId, skip`);
        warned++;
        continue;
      }

      const patch = buildOwnerMigrationPatch(data);
      console.log(
          `[UPDATE] PromoCodeAssignments/${doc.id} role=owner rootSuperAffiliateId=${affiliateId}`,
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

    lastDoc = page.docs[page.docs.length - 1];
    if (page.size < PAGE_SIZE) {
      hasMore = false;
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

  console.log(
      `\nDone. Updated: ${updated}, Skipped: ${skipped}, Warned: ${warned}, Errors: ${errors}.`,
  );
  if (DRY_RUN) {
    console.log("(dry-run — no documents were written)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
