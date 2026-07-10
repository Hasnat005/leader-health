/* eslint-disable require-jsdoc, max-len */
/**
 * Wipe catalog + promo mirror collections and clear SyncState hashes so the
 * next scheduled sync repopulates everything from Gen-Health.
 *
 * Does NOT touch PromoCodeAssignments, AffiliateProfiles, CheckoutOrders, etc.
 *
 * Usage (from firebase/functions):
 *   node scripts/resetSyncState.js
 *   node scripts/resetSyncState.js --dry-run
 *
 * Targets staging-nxgenrx via firebaseStagingServiceAccount in config.js.
 */

const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");
const {firebaseStagingServiceAccount} = require("../config.js");

const BATCH_SIZE = 400;

const COLLECTIONS_TO_WIPE = [
  "PromoCodes",
  "Products",
  "Categories",
];

const SYNC_STATE_CLEARS = [
  {docId: "catalog", label: "catalog"},
  {docId: "promocodes", label: "promocodes"},
];

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} collectionId
 * @return {Promise<number>}
 */
async function deleteCollection(db, collectionId) {
  const col = db.collection(collectionId);
  let totalDeleted = 0;
  /** @type {FirebaseFirestore.QueryDocumentSnapshot | undefined} */
  let lastDoc;
  let hasMore = true;

  while (hasMore) {
    let query = col.orderBy(admin.firestore.FieldPath.documentId()).limit(BATCH_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    if (snap.empty) {
      hasMore = false;
      break;
    }

    totalDeleted += snap.size;
    hasMore = snap.size >= BATCH_SIZE;
    lastDoc = snap.docs[snap.docs.length - 1];

    if (DRY_RUN) continue;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }

  return totalDeleted;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} docId
 * @param {string} label
 */
async function clearSyncStateHash(db, docId, label) {
  const ref = db.collection("SyncState").doc(docId);
  const snap = await ref.get();
  const hadHash = snap.exists && snap.get("lastApiHash") != null;

  if (DRY_RUN) {
    console.log(
        `  SyncState/${docId}: would clear lastApiHash` +
        (hadHash ? " (field present)" : " (doc missing or no hash)"),
    );
    return;
  }

  await ref.set(
      {lastApiHash: FieldValue.delete(), lastRunAt: FieldValue.serverTimestamp()},
      {merge: true},
  );
  console.log(`  SyncState/${docId} (${label}): cleared lastApiHash`);
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
  console.log(DRY_RUN ? "DRY RUN — no writes\n" : "Resetting GH mirror collections…\n");

  for (const collectionId of COLLECTIONS_TO_WIPE) {
    const count = await deleteCollection(db, collectionId);
    console.log(
        `  ${collectionId}: ${DRY_RUN ? "would delete" : "deleted"} ${count} doc(s)`,
    );
  }

  console.log("\nSyncState:");
  for (const {docId, label} of SYNC_STATE_CLEARS) {
    await clearSyncStateHash(db, docId, label);
  }

  console.log(
      "\nDone." +
      (DRY_RUN ?
        " Re-run without --dry-run to apply." :
        " Wait ~2 min for syncCatalogScheduled + syncPromoScheduled to repopulate from GH."),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
