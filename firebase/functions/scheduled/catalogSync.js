/**
 * Scheduled catalog mirror from gen-health → Firestore.
 */

const logger = require("firebase-functions/logger");
const {FieldValue} = require("firebase-admin/firestore");
const {db} = require("../utils/Firebase");
const {stableStringify, sha1Hex} = require("../utils/hash");
const {fetchCategories, fetchProducts} = require("../utils/genHealthApi");
const {syncCategories} = require("../lib/catalog/categories");
const {syncProducts} = require("../lib/catalog/products");

const STATE_DOC = "catalog";

/**
 * @param {Array<{categoryId: string}>} cats
 * @return {Array<{categoryId: string}>}
 */
function sortCats(cats) {
  return [...cats].sort((a, b) =>
    (a.categoryId || "").localeCompare(b.categoryId || ""));
}

/**
 * @param {Array<!Object>} prods Product rows
 * @return {Array<!Object>} Sorted copy
 */
function sortProds(prods) {
  return [...prods].sort((a, b) => {
    const aid = String(a.clientProductId || "");
    const bid = String(b.clientProductId || "");
    return aid.localeCompare(bid);
  });
}

/**
 * @param {Array<{categoryId: string}>} categories Category rows
 * @param {Array<!Object>} products Product rows
 * @return {string} Hex SHA-1 of canonical payload
 */
function computeApiHash(categories, products) {
  return sha1Hex(stableStringify({
    /** Bust cache when ingest rules change (e.g. Gen Health price unit). */
    catalogIngestVersion: 2,
    categories: sortCats(categories),
    products: sortProds(products),
  }));
}

/**
 * @return {Promise<Object>} ok / unchanged / error fields
 */
async function runCatalogSync() {
  logger.info("catalogSync: invocation started");
  const stateRef = db.collection("SyncState").doc(STATE_DOC);
  try {
    logger.info("catalogSync: fetching categories from gen-health API");
    const categories = await fetchCategories();
    logger.info("catalogSync: categories fetched", {count: categories.length});
    logger.info("catalogSync: fetching products from gen-health API");
    const products = await fetchProducts();
    logger.info("catalogSync: products fetched", {count: products.length});

    const apiHash = computeApiHash(categories, products);
    logger.info("catalogSync: API hash computed", {
      apiHashPrefix: apiHash.slice(0, 8) + "…",
    });

    const stateSnap = await stateRef.get();
    const lastApiHash = stateSnap.exists ? stateSnap.get("lastApiHash") : null;
    logger.info("catalogSync: SyncState loaded", {
      exists: stateSnap.exists,
      lastApiHashPrefix: lastApiHash ?
        String(lastApiHash).slice(0, 8) + "…" : null,
    });

    if (apiHash === lastApiHash) {
      await stateRef.set(
          {lastRunAt: FieldValue.serverTimestamp()},
          {merge: true},
      );
      logger.info(
          "catalogSync: API unchanged vs lastApiHash; skipping Firestore sync",
      );
      logger.info("catalogSync: invocation finished", {unchanged: true});
      return {ok: true, unchanged: true};
    }

    await syncCategories(db, categories, logger);
    const clientCategoryIds = new Set(
        categories.map((c) => c.categoryId),
    );
    await syncProducts(db, products, clientCategoryIds, logger);

    await stateRef.set({
      lastApiHash: apiHash,
      lastRunAt: FieldValue.serverTimestamp(),
    }, {merge: true});

    logger.info("catalogSync: invocation finished", {unchanged: false});
    return {ok: true, unchanged: false};
  } catch (err) {
    logger.error("catalogSync: upstream or sync failure", err);
    logger.info("catalogSync: invocation finished", {ok: false});
    return {ok: false, error: String(err && err.message ? err.message : err)};
  }
}

module.exports = {runCatalogSync, computeApiHash};
