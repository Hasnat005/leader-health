/**
 * Category sync: diff, per-doc hash, archive missing upstream ids.
 */

const {FieldValue} = require("firebase-admin/firestore");
const {stableStringify, sha1Hex, chunkBatches} = require("../../utils/hash");

const COL = "Categories";

/**
 * @param {string} categoryId
 * @param {string} categoryName
 * @param {boolean} archived
 * @return {string}
 */
function categoryHash(categoryId, categoryName, archived) {
  return sha1Hex(stableStringify({
    categoryId,
    categoryName,
    archived: Boolean(archived),
  }));
}

/**
 * @param {*} db Firestore instance
 * @param {Array<{categoryId: string, categoryName: string}>} categories
 * @param {*} logger Logger
 * @return {Promise<Object>} Write and skip counts
 */
async function syncCategories(db, categories, logger) {
  const apiById = new Map(
      categories.map((c) => [c.categoryId, c]),
  );
  const snap = await db.collection(COL).get();
  const existing = new Map(snap.docs.map((d) => [d.id, d.data() || {}]));

  const writes = [];
  let skipped = 0;

  for (const c of categories) {
    const archived = false;
    const h = categoryHash(c.categoryId, c.categoryName, archived);
    const prev = existing.get(c.categoryId);
    if (prev && prev.syncHash === h && !prev.archived) {
      skipped++;
      continue;
    }
    const ts = FieldValue.serverTimestamp();
    writes.push({
      ref: db.collection(COL).doc(c.categoryId),
      data: {
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        archived: false,
        archivedAt: null,
        syncHash: h,
        syncedAt: ts,
        updatedAt: ts,
      },
    });
  }

  for (const [id, prev] of existing) {
    if (apiById.has(id)) {
      continue;
    }
    if (prev.archived) {
      continue;
    }
    const name = String(prev.categoryName || prev.categoryId || id);
    const h = categoryHash(id, name, true);
    if (prev.syncHash === h) {
      skipped++;
      continue;
    }
    const ts = FieldValue.serverTimestamp();
    writes.push({
      ref: db.collection(COL).doc(id),
      data: {
        categoryId: id,
        categoryName: name,
        archived: true,
        archivedAt: ts,
        syncHash: h,
        syncedAt: ts,
        updatedAt: ts,
      },
    });
  }

  const chunks = chunkBatches(writes, 500);
  for (let i = 0; i < chunks.length; i++) {
    const batch = db.batch();
    for (const w of chunks[i]) {
      batch.set(w.ref, w.data, {merge: false});
    }
    await batch.commit();
    logger.info("syncCategories: batch committed", {
      batchIndex: i + 1,
      totalBatches: chunks.length,
      opsInBatch: chunks[i].length,
    });
  }

  logger.info("syncCategories: finished", {
    apiCategoryCount: categories.length,
    writes: writes.length,
    skipped,
  });

  return {writes: writes.length, skipped};
}

module.exports = {syncCategories, categoryHash};
