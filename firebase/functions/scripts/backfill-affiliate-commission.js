/* eslint-disable require-jsdoc, max-len */
/**
 * One-time backfill: computes and writes `commissionCents` for all affiliate
 * order projection documents that are missing the field (or all with --force).
 *
 * Uses {@link computeCommissionCentsFromSnapshots} so fixed and percentage
 * commission snapshots are both supported.
 *
 * Run from `firebase/functions`:
 *   node scripts/backfill-affiliate-commission.js
 *
 * or via npm:
 *   npm run backfill:affiliate-commission
 *
 * Safe to re-run — it only touches docs where `commissionCents` is undefined
 * unless --force.
 */

const admin = require("firebase-admin");
const {firebaseServiceAccount} = require("../config.js");
const {computeCommissionCentsFromSnapshots} = require("../lib/checkout/commissionModel.js");

const FORCE = process.argv.includes("--force");

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({credential: admin.credential.cert(firebaseServiceAccount)});
  }
  const db = admin.firestore();

  const profilesSnap = await db.collection("AffiliateProfiles").get();
  console.log(`Found ${profilesSnap.size} affiliate profile(s).`);

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const profileDoc of profilesSnap.docs) {
    const affiliateId = profileDoc.id;
    const ordersSnap = await db
        .collection("AffiliateProfiles")
        .doc(affiliateId)
        .collection("Orders")
        .get();

    if (ordersSnap.empty) continue;

    let batch = db.batch();
    let batchCount = 0;

    for (const orderDoc of ordersSnap.docs) {
      const data = orderDoc.data();

      if (!FORCE && typeof data.commissionCents === "number") {
        totalSkipped++;
        continue;
      }

      const commissionTypeSnapshot =
        typeof data.commissionTypeSnapshot === "string" ?
          data.commissionTypeSnapshot.trim().toLowerCase() :
          "percentage";

      let commissionFixedCentsSnapshot = null;
      const rawFixed = data.commissionFixedCentsSnapshot;
      if (typeof rawFixed === "number" && Number.isFinite(rawFixed)) {
        commissionFixedCentsSnapshot = Math.round(rawFixed);
      }

      const commissionRateSnapshot =
        typeof data.commissionRateSnapshot === "number" &&
        Number.isFinite(data.commissionRateSnapshot) ?
          data.commissionRateSnapshot :
          null;

      const originalAmountCents =
        typeof data.originalAmountCents === "number" ?
          data.originalAmountCents :
          typeof data.amountCents === "number" ?
            data.amountCents :
            null;

      if (originalAmountCents == null || !Number.isFinite(originalAmountCents)) {
        console.warn(
            `  [SKIP] ${affiliateId}/Orders/${orderDoc.id} — missing originalAmountCents`,
            {originalAmountCents},
        );
        totalSkipped++;
        continue;
      }

      const commissionCents = computeCommissionCentsFromSnapshots({
        commissionTypeSnapshot,
        commissionFixedCentsSnapshot,
        commissionRateSnapshot,
        originalAmountCents,
      });

      console.log(
          `  [UPDATE] ${affiliateId}/Orders/${orderDoc.id}` +
          ` originalAmountCents=${originalAmountCents}` +
          ` type=${commissionTypeSnapshot}` +
          ` → commissionCents=${commissionCents}`,
      );

      batch.update(orderDoc.ref, {commissionCents});
      batchCount++;
      totalUpdated++;

      if (batchCount === 499) {
        await batch.commit();
        console.log(`  Flushed batch of ${batchCount} for affiliate ${affiliateId}.`);
        batchCount = 0;
        batch = db.batch();
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }
  }

  console.log(`\nDone. Updated: ${totalUpdated}, Skipped: ${totalSkipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
