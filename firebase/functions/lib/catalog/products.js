/**
 * Product sync: matched categories, per-doc hash, archive rules.
 */

const {FieldValue} = require("firebase-admin/firestore");
const {stableStringify, sha1Hex, chunkBatches} = require("../../utils/hash");
const {CATALOG_PROVIDER_GEN_HEALTH} = require("../catalogProvider.js");

const COL = "Products";

/**
 * Gen Health clientProducts: `pricing.amount` is major units (USD dollars).
 * Stored as integer cents in Firestore. Only for upstream API rows.
 *
 * @param {*} pricing
 * @return {{amount: number, currency: string}}
 */
function normalizeGenHealthPricingToCents(pricing) {
  if (!pricing || typeof pricing !== "object") {
    return {amount: 0, currency: "usd"};
  }
  const cur =
    typeof pricing.currency === "string" && pricing.currency.trim() ?
      String(pricing.currency).trim().toLowerCase() :
      "usd";
  const raw = pricing.amount;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return {amount: 0, currency: cur};
  }
  return {amount: Math.round(raw * 100), currency: cur};
}

/**
 * @param {*} raw
 * @return {string[]}
 */
function normalizeCategoriesArr(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((x) => String(x || "").trim()).filter(Boolean);
}

/**
 * @param {!Object} raw Product payload
 * @param {Set<string>} clientCategoryIds
 * @return {string[]}
 */
function matchedFor(raw, clientCategoryIds) {
  const ids = normalizeCategoriesArr(raw.categories);
  const matched = ids.filter((id) => clientCategoryIds.has(id));
  matched.sort((a, b) => a.localeCompare(b));
  return matched;
}

/**
 * @param {!Object} raw Product payload
 * @param {string[]} matchedSorted
 * @param {boolean} archived
 * @param {boolean} fromGenHealthApi Convert dollars to cents when true.
 * @return {string}
 */
function productPayloadForHash(raw, matchedSorted, archived, fromGenHealthApi) {
  const categoriesSorted = normalizeCategoriesArr(raw.categories)
      .sort((a, b) => a.localeCompare(b));
  const pricing = fromGenHealthApi ?
    normalizeGenHealthPricingToCents(raw.pricing) :
    (raw.pricing && typeof raw.pricing === "object" ? raw.pricing : {});
  const payload = {
    clientProductId: String(raw.clientProductId || ""),
    productId: String(raw.productId || ""),
    type: raw.type === undefined || raw.type === null ?
      null : String(raw.type),
    name: String(raw.name || ""),
    displayName: String(raw.displayName || raw.name || ""),
    description: String(raw.description || ""),
    categories: categoriesSorted,
    matchedClientCategories: [...matchedSorted].sort((a, b) =>
      a.localeCompare(b)),
    primaryCategory: String(raw.primaryCategory || ""),
    pricing,
    requiresSyncVisit: Boolean(raw.requiresSyncVisit),
    // Eligible unless API sets storefrontEligible false.
    storefrontEligible: raw.storefrontEligible !== false,
    imageUrl: String(raw.imageUrl || ""),
    displayImageUrl: String(raw.displayImageUrl || ""),
    archived: Boolean(archived),
    catalog_provider: CATALOG_PROVIDER_GEN_HEALTH,
  };
  return stableStringify(payload);
}

/**
 * @param {string} payloadStr
 * @return {string}
 */
function productHash(payloadStr) {
  return sha1Hex(payloadStr);
}

/**
 * @param {!Object} raw Product payload
 * @param {string[]} matchedSorted
 * @param {boolean} archived
 * @param {boolean} fromGenHealthApi Convert dollars to cents when true.
 * @return {!Object} Firestore product document
 */
function productDocFromApi(raw, matchedSorted, archived, fromGenHealthApi) {
  const h = productHash(
      productPayloadForHash(raw, matchedSorted, archived, fromGenHealthApi),
  );
  const ts = FieldValue.serverTimestamp();
  const pricing = fromGenHealthApi ?
    normalizeGenHealthPricingToCents(raw.pricing) :
    (raw.pricing && typeof raw.pricing === "object" ?
      raw.pricing : {amount: 0, currency: "usd"});
  return {
    clientProductId: String(raw.clientProductId || ""),
    productId: String(raw.productId || ""),
    type: raw.type === undefined || raw.type === null ? null : raw.type,
    name: String(raw.name || ""),
    displayName: String(raw.displayName || raw.name || ""),
    description: String(raw.description || ""),
    categories: normalizeCategoriesArr(raw.categories),
    matchedClientCategories: matchedSorted,
    primaryCategory: String(raw.primaryCategory || ""),
    pricing,
    requiresSyncVisit: Boolean(raw.requiresSyncVisit),
    // Eligible unless API sets storefrontEligible false.
    storefrontEligible: raw.storefrontEligible !== false,
    imageUrl: String(raw.imageUrl || ""),
    displayImageUrl: String(raw.displayImageUrl || ""),
    archived,
    archivedAt: archived ? ts : null,
    catalog_provider: CATALOG_PROVIDER_GEN_HEALTH,
    syncHash: h,
    syncedAt: ts,
    updatedAt: ts,
  };
}

/**
 * Dashboard-only fields on Products/{id} not from Gen Health.
 * Preserved across full-document sync writes.
 *
 * @param {?Object} prev Existing Firestore doc or null
 * @param {!Object} apiDoc From API (full replacement shape)
 * @return {!Object}
 */
function mergePreservedProductFields(prev, apiDoc) {
  if (!prev || typeof prev !== "object") {
    return apiDoc;
  }
  const out = {...apiDoc};
  if (Object.prototype.hasOwnProperty.call(prev, "featured")) {
    out.featured = prev.featured === true;
  }
  return out;
}

/**
 * @param {*} db Firestore instance
 * @param {Array<!Object>} products Upstream products
 * @param {Set<string>} clientCategoryIds Active category ids
 * @param {*} logger Logger
 * @return {Promise<Object>} Write and skip counts
 */
async function syncProducts(db, products, clientCategoryIds, logger) {
  const apiIds = new Set(
      products.map((p) => String(p.clientProductId || "")).filter(Boolean),
  );
  const snap = await db.collection(COL).get();
  const existing = new Map(snap.docs.map((d) => [d.id, d.data() || {}]));

  const writes = [];
  let skipped = 0;
  let skippedNoCategory = 0;

  for (const p of products) {
    const id = String(p.clientProductId || "");
    if (!id) {
      continue;
    }
    const matched = matchedFor(p, clientCategoryIds);
    const prev = existing.get(id);

    if (!matched.length) {
      if (!prev) {
        skippedNoCategory++;
        continue;
      }
      if (prev.archived) {
        skipped++;
        continue;
      }
      const payloadStr = productPayloadForHash(p, [], true, true);
      const h = productHash(payloadStr);
      if (prev.syncHash === h) {
        skipped++;
        continue;
      }
      writes.push({
        ref: db.collection(COL).doc(id),
        data: mergePreservedProductFields(
            prev,
            productDocFromApi(p, [], true, true),
        ),
      });
      continue;
    }

    const payloadStr = productPayloadForHash(p, matched, false, true);
    const h = productHash(payloadStr);
    if (prev && prev.syncHash === h && !prev.archived) {
      skipped++;
      continue;
    }
    writes.push({
      ref: db.collection(COL).doc(id),
      data: mergePreservedProductFields(
          prev,
          productDocFromApi(p, matched, false, true),
      ),
    });
  }

  for (const [id, prev] of existing) {
    if (apiIds.has(id)) {
      continue;
    }
    if (prev.archived) {
      continue;
    }
    const raw = {
      clientProductId: id,
      productId: String(prev.productId || ""),
      type: prev.type,
      name: String(prev.name || ""),
      displayName: String(prev.displayName || ""),
      description: String(prev.description || ""),
      categories: normalizeCategoriesArr(prev.categories),
      primaryCategory: String(prev.primaryCategory || ""),
      pricing: prev.pricing || {},
      requiresSyncVisit: Boolean(prev.requiresSyncVisit),
      storefrontEligible: Boolean(prev.storefrontEligible),
      imageUrl: String(prev.imageUrl || ""),
      displayImageUrl: String(prev.displayImageUrl || ""),
    };
    const matched = [];
    const payloadStr = productPayloadForHash(raw, matched, true, false);
    const h = productHash(payloadStr);
    if (prev.syncHash === h) {
      skipped++;
      continue;
    }
    writes.push({
      ref: db.collection(COL).doc(id),
      data: mergePreservedProductFields(
          prev,
          productDocFromApi(raw, matched, true, false),
      ),
    });
  }

  const chunks = chunkBatches(writes, 500);
  for (let i = 0; i < chunks.length; i++) {
    const batch = db.batch();
    for (const w of chunks[i]) {
      batch.set(w.ref, w.data, {merge: false});
    }
    await batch.commit();
    logger.info("syncProducts: batch committed", {
      batchIndex: i + 1,
      totalBatches: chunks.length,
      opsInBatch: chunks[i].length,
    });
  }

  logger.info("syncProducts: finished", {
    apiProductCount: products.length,
    writes: writes.length,
    skipped,
    skippedNoCategory,
  });

  return {writes: writes.length, skipped, skippedNoCategory};
}

module.exports = {
  syncProducts,
  matchedFor,
  productPayloadForHash,
  productHash,
  normalizeGenHealthPricingToCents,
};
