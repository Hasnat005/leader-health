const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const {
  mapPromocodeFromApi,
  promoHash,
  promoHashPayload,
} = require("./promoMapper.js");
const {chunkBatches} = require("../../utils/hash.js");
const {
  CATALOG_PROVIDER_DOTFIT,
  catalogProviderFromProductData,
} = require("../catalogProvider.js");

/**
 * dotFIT promos are dashboard-managed; GH sync must not upsert or archive them.
 * @param {Record<string, unknown> | undefined} prev
 * @return {boolean}
 */
function isDotfitOwnedPromo(prev) {
  return catalogProviderFromProductData(prev) === CATALOG_PROVIDER_DOTFIT;
}

const COL = "PromoCodes";
const PRODUCTS_COL = "Products";

/**
 * Client product ids present in synced Gen Health catalog (Firestore Products).
 * @param {FirebaseFirestore.Firestore} db
 * @return {Promise<Set<string>>}
 */
async function loadGenHealthCatalogClientProductIds(db) {
  const snap = await db.collection(PRODUCTS_COL).get();
  const ids = new Set();
  snap.forEach((doc) => {
    const data = doc.data() || {};
    const docId = String(doc.id || "").trim();
    if (docId) ids.add(docId);
    const clientProductId = String(data.clientProductId || "").trim();
    if (clientProductId) ids.add(clientProductId);
    const productId = String(data.productId || "").trim();
    if (productId) ids.add(productId);
  });
  logger.info("syncPromos: catalog product ids loaded", {
    count: ids.size,
  });
  return ids;
}

/**
 * @param {Record<string, unknown>} fields
 * @param {boolean} archived
 * @param {string} hash
 * @param {FirebaseFirestore.FieldValue} now
 * @param {Record<string, unknown> | undefined} prev
 * @return {Record<string, unknown>}
 */
function promoDocData(fields, archived, hash, now, prev) {
  const assignedAffiliateIds = Array.isArray(prev?.assignedAffiliateIds) ?
    prev.assignedAffiliateIds :
    [];
  const assignedAffiliateId =
    typeof prev?.assignedAffiliateId === "string" ?
      prev.assignedAffiliateId :
      null;
  const createdAt = prev?.createdAt != null ? prev.createdAt : now;

  return {
    ...fields,
    assignedAffiliateIds,
    assignedAffiliateId,
    archived: Boolean(archived),
    archivedAt: archived ? now : null,
    syncedAt: now,
    updatedAt: now,
    syncHash: hash,
    createdAt,
  };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {Array<Record<string, unknown>>} apiPromocodes
 * @return {Promise<Object>}
 */
async function syncPromos(db, apiPromocodes) {
  logger.info("syncPromos: started", {apiPromocodeCount: apiPromocodes.length});

  const catalogClientProductIds =
    await loadGenHealthCatalogClientProductIds(db);

  const apiByCode = new Map();
  for (const raw of apiPromocodes) {
    try {
      const {code} = mapPromocodeFromApi(raw, false, catalogClientProductIds);
      apiByCode.set(code, raw);
    } catch (e) {
      logger.warn("syncPromos: skip invalid API promocode", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const snap = await db.collection(COL).get();
  /** @type {Map<string, FirebaseFirestore.DocumentData>} */
  const existing = new Map();
  snap.forEach((d) => {
    existing.set(d.id, d.data() || {});
  });

  const now = admin.firestore.FieldValue.serverTimestamp();
  /** @type {Array<{
   *   ref: FirebaseFirestore.DocumentReference,
   *   data: Record<string, unknown>
   * }>} */
  const writes = [];

  let created = 0;
  let updated = 0;
  let archived = 0;
  let unchanged = 0;

  for (const [code, raw] of apiByCode) {
    const prev = existing.get(code);
    if (isDotfitOwnedPromo(prev)) {
      logger.warn("syncPromos: skip dotfit-owned promo (upsert)", {code});
      unchanged++;
      continue;
    }

    const {fields, hashPayload} = mapPromocodeFromApi(
        raw,
        false,
        catalogClientProductIds,
    );
    const h = promoHash(hashPayload);
    const wasArchived = Boolean(prev?.archived);

    if (prev && prev.syncHash === h && !wasArchived) {
      unchanged++;
      continue;
    }

    if (fields.eligibleProductIdsNotInCatalog?.length > 0) {
      logger.info("syncPromos: GH eligible ids not in local catalog", {
        code,
        ghEligibleCount: fields.genHealthEligibleClientProductIds?.length ?? 0,
        mirroredCount: fields.productIds?.length ?? 0,
        notInCatalogCount: fields.eligibleProductIdsNotInCatalog.length,
      });
    }

    writes.push({
      ref: db.collection(COL).doc(code),
      data: promoDocData(fields, false, h, now, prev),
    });

    if (!prev || Object.keys(prev).length === 0) {
      created++;
    } else {
      updated++;
    }
  }

  for (const [id, prev] of existing) {
    if (apiByCode.has(id)) continue;
    if (prev.archived) {
      unchanged++;
      continue;
    }
    if (isDotfitOwnedPromo(prev)) {
      logger.warn("syncPromos: skip dotfit-owned promo (archive)", {code: id});
      unchanged++;
      continue;
    }

    const archivedFields = mapPromocodeFromApi(
        {
          normalizedCode: id,
          code: id,
          status: "inactive",
          discount: {type: "percentage_off", value: 0},
          assignmentType: null,
          eligibleClientProductIds: [],
          maxUsage: null,
          usageCount: typeof prev.usageCount === "number" ? prev.usageCount : 0,
          validity: null,
          affiliates: [],
        },
        true,
        catalogClientProductIds,
    );
    const mergedFields = {
      ...archivedFields.fields,
      name: prev.name ?? archivedFields.fields.name,
      discountType: prev.discountType ?? archivedFields.fields.discountType,
      discountValue: prev.discountValue ?? archivedFields.fields.discountValue,
      appliesTo: archivedFields.fields.appliesTo,
      categoryIds: [],
      productIds: archivedFields.fields.productIds,
      genHealthEligibleClientProductIds:
        archivedFields.fields.genHealthEligibleClientProductIds,
      eligibleProductIdsNotInCatalog:
        archivedFields.fields.eligibleProductIdsNotInCatalog,
      state: prev.state ?? archivedFields.fields.state,
      usageLimit: prev.usageLimit ?? null,
      usageCount: typeof prev.usageCount === "number" ? prev.usageCount : 0,
      validity: prev.validity ?? null,
      expiresAt: prev.expiresAt ?? null,
      affiliatesSnapshot: prev.affiliatesSnapshot ?? [],
      genHealthPromocodeId: prev.genHealthPromocodeId ?? null,
    };
    const h = promoHash(promoHashPayload(mergedFields));

    if (prev.syncHash === h && prev.archived) {
      unchanged++;
      continue;
    }

    writes.push({
      ref: db.collection(COL).doc(id),
      data: promoDocData(mergedFields, true, h, now, prev),
    });
    archived++;
  }

  const chunks = chunkBatches(writes, 500);
  logger.info("syncPromos: committing writes", {
    writeCount: writes.length,
    batchCount: chunks.length,
    created,
    updated,
    archived,
    unchanged,
  });

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const batch = db.batch();
    for (const w of chunk) {
      batch.set(w.ref, w.data, {merge: false});
    }
    await batch.commit();
  }

  const out = {
    counts: {
      fetched: apiPromocodes.length,
      created,
      updated,
      archived,
      unchanged,
    },
  };
  logger.info("syncPromos: finished", {counts: out.counts});
  return out;
}

module.exports = {syncPromos, COL};
