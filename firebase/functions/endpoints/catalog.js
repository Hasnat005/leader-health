/**
 * Public storefront catalog HTTP API (read-only).
 */

const logger = require("firebase-functions/logger");
const {
  CATALOG_PROVIDER_GEN_HEALTH,
  catalogProviderFromProductData,
} = require("../lib/catalogProvider.js");
const {db, storage} = require("../utils/Firebase");
const {sendJson} = require("../utils/httpJson");

const CACHE_CATALOG =
    "public, max-age=120, stale-while-revalidate=60";
const CACHE_DETAIL =
    "public, max-age=300, stale-while-revalidate=120";

const SIGNED_URL_MS = 7 * 24 * 3600 * 1000;

/**
 * @param {*} req HTTP request
 * @return {string} Normalized path after function name segment.
 */
function httpPath(req) {
  const raw = req.originalUrl || req.url || "/";
  const pathname = raw.split("?")[0] || "/";
  const parts = pathname.split("/").filter(Boolean);
  const fnIdx = parts.indexOf("catalogHttp");
  const rel = fnIdx >= 0 ? parts.slice(fnIdx + 1) : parts;
  return "/" + rel.join("/");
}

/**
 * @param {*} v
 * @return {*}
 */
function serializeValue(v) {
  if (v === null || v === undefined) {
    return v;
  }
  if (typeof v.toDate === "function") {
    try {
      return v.toDate().toISOString();
    } catch (e) {
      return null;
    }
  }
  if (typeof v.toMillis === "function") {
    try {
      return new Date(v.toMillis()).toISOString();
    } catch (e) {
      return null;
    }
  }
  if (Array.isArray(v)) {
    return v.map(serializeValue);
  }
  if (typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v)) {
      o[k] = serializeValue(v[k]);
    }
    return o;
  }
  return v;
}

/**
 * Storefront products must have a positive price (cents).
 * @param {!Object} data Product fields
 * @return {boolean}
 */
function hasPricedAmount(data) {
  const pricing = data && data.pricing && typeof data.pricing === "object" ?
    data.pricing :
    null;
  const amount = pricing && typeof pricing.amount === "number" ?
    pricing.amount :
    NaN;
  return Number.isFinite(amount) && amount > 0;
}

/**
 * @param {!Object} data Product fields
 * @param {string} id Document id
 * @return {!Object} Storefront-safe product shape
 */
function productToApiShape(data, id) {
  const d = data || {};
  return {
    clientProductId: id,
    productId: d.productId != null ? String(d.productId) : "",
    type: d.type == null ? null : d.type,
    name: String(d.name || ""),
    displayName: String(d.displayName || ""),
    description: String(d.description || ""),
    categories: Array.isArray(d.categories) ? d.categories : [],
    matchedClientCategories: Array.isArray(d.matchedClientCategories) ?
      d.matchedClientCategories : [],
    primaryCategory: String(d.primaryCategory || ""),
    pricing: d.pricing && typeof d.pricing === "object" ? d.pricing : {},
    requiresSyncVisit: Boolean(d.requiresSyncVisit),
    storefrontEligible: d.storefrontEligible !== false,
    imageUrl: String(d.imageUrl || ""),
    displayImageUrl: String(d.displayImageUrl || ""),
    archived: Boolean(d.archived),
    featured: d.featured === true,
    catalog_provider:
      catalogProviderFromProductData(d) || CATALOG_PROVIDER_GEN_HEALTH,
  };
}

/**
 * @param {Record<string, unknown>} raw LandingContent doc data
 * @return {Record<string, unknown>} Trimmed shape for product list cards
 */
function landingContentSummaryFromDoc(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  const benefits = Array.isArray(d.benefits) ? d.benefits : [];
  return {
    template: String(d.template || ""),
    featureName: String(d.featureName || ""),
    blendCoreFeature: String(d.blendCoreFeature || ""),
    additionalTags: Array.isArray(d.additionalTags) ? d.additionalTags : [],
    strength: String(d.strength || ""),
    quantity: String(d.quantity || ""),
    subtitlePreview: String(d.subtitlePreview || ""),
    benefits: benefits.slice(0, 8).map((x) => String(x)),
  };
}

/**
 * @param {Record<string, unknown>} raw LandingContent doc data
 * @return {Record<string, unknown>}
 */
function landingContentFullFromDoc(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  return {
    strength: String(d.strength || ""),
    quantity: String(d.quantity || ""),
    dosageFrequencyInstruction: String(d.dosageFrequencyInstruction || ""),
    administrationInstruction: String(d.administrationInstruction || ""),
    benefits: Array.isArray(d.benefits) ? d.benefits : [],
    dosage: d.dosage && typeof d.dosage === "object" ? d.dosage : {},
    safety: d.safety && typeof d.safety === "object" ? d.safety : {},
    relatedProductIds: Array.isArray(d.relatedProductIds) ?
      d.relatedProductIds : [],
    featureName: String(d.featureName || ""),
    blendCoreFeature: String(d.blendCoreFeature || ""),
    additionalTags: Array.isArray(d.additionalTags) ? d.additionalTags : [],
    blendProductName: String(d.blendProductName || ""),
    template: String(d.template || ""),
    subtitlePreview: String(d.subtitlePreview || ""),
    updatedAt: d.updatedAt != null ? serializeValue(d.updatedAt) : null,
  };
}

/**
 * @param {*} db Firestore
 * @param {!Array<*>} refs Document refs
 * @return {Promise<Array<*>>} Document snapshots
 */
async function getAllDocsBatched(db, refs) {
  const snaps = [];
  const batchSize = 10;
  for (let i = 0; i < refs.length; i += batchSize) {
    const chunk = refs.slice(i, i + batchSize);
    const part = await db.getAll(...chunk);
    snaps.push(...part);
  }
  return snaps;
}

/**
 * @param {string} storagePath GCS URI or object path.
 * @return {!Object} Parsed bucket and object path.
 */
function parseGsPath(storagePath) {
  if (!storagePath || typeof storagePath !== "string") {
    return {objectPath: ""};
  }
  if (!storagePath.startsWith("gs://")) {
    return {objectPath: storagePath};
  }
  const s = storagePath.slice("gs://".length);
  const i = s.indexOf("/");
  if (i < 0) {
    return {objectPath: ""};
  }
  return {bucketName: s.slice(0, i), objectPath: s.slice(i + 1)};
}

/**
 * @param {string} storagePath
 * @return {Promise<string|null>}
 */
async function signedReadUrl(storagePath) {
  const parsed = parseGsPath(storagePath);
  if (!parsed.objectPath) {
    return null;
  }
  const bucket = parsed.bucketName ?
    storage.bucket(parsed.bucketName) :
    storage.bucket();
  const file = bucket.file(parsed.objectPath);
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + SIGNED_URL_MS,
  });
  return url;
}

/**
 * @param {!Object} row Service content row
 * @return {Promise<Object>} Row plus optional signed URL
 */
async function enrichServiceRow(row) {
  const out = {...row};
  if (row.storagePath) {
    try {
      const resolvedIconUrl = await signedReadUrl(String(row.storagePath));
      if (resolvedIconUrl) {
        out.resolvedIconUrl = resolvedIconUrl;
      }
    } catch (e) {
      logger.warn("catalogHttp: signed_url_failed", {
        message: e && e.message,
        storagePath: row.storagePath,
      });
    }
  }
  return out;
}

/**
 * @param {string} clientProductId Product id
 * @return {Promise<Object|string>} Detail body or status string
 */
async function loadProductDetailForRequest(clientProductId) {
  const ref = db.collection("Products").doc(clientProductId);
  const snap = await ref.get();
  if (!snap.exists) {
    return "missing";
  }
  const data = snap.data() || {};
  if (
    data.archived ||
    data.storefrontEligible !== true ||
    !hasPricedAmount(data)
  ) {
    return "unavailable";
  }
  const contentSnap = await ref.collection("content").get();
  const services = [];
  const faq = [];
  for (const doc of contentSnap.docs) {
    const row = {id: doc.id, ...doc.data()};
    const kind = String(row.kind || "").toLowerCase();
    if (kind === "service") {
      services.push(row);
    } else if (kind === "faq") {
      faq.push(row);
    }
  }
  const orderKey = (a, b) => {
    const ao = typeof a.order === "number" ? a.order : 0;
    const bo = typeof b.order === "number" ? b.order : 0;
    return ao - bo;
  };
  services.sort(orderKey);
  faq.sort(orderKey);

  const enriched = [];
  for (const s of services) {
    enriched.push(await enrichServiceRow(s));
  }

  let landingContent = null;
  try {
    const lcSnap = await ref.collection("landingContent").doc("main").get();
    if (lcSnap.exists) {
      const raw = lcSnap.data() || {};
      landingContent = serializeValue(landingContentFullFromDoc(raw));
    }
  } catch (e) {
    logger.warn("catalogHttp: landingContent_read_failed", {
      clientProductId,
      message: e && e.message,
    });
  }

  return {
    product: serializeValue(productToApiShape(data, clientProductId)),
    landingContent,
    content: {
      services: serializeValue(enriched),
      faq: serializeValue(faq),
    },
  };
}

/**
 * @param {*} req HTTP request
 * @param {*} res HTTP response
 */
async function catalogHttp(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.set("Allow", "GET, HEAD");
    sendJson(res, 405, {success: false, error: "Method not allowed"});
    return;
  }

  const path = httpPath(req);
  try {
    if (path === "/categories" || path.endsWith("/categories")) {
      res.set("Cache-Control", CACHE_CATALOG);
      if (req.method === "HEAD") {
        res.status(204).send("");
        return;
      }
      const snap = await db.collection("Categories")
          .where("archived", "==", false)
          .get();
      const categories = [];
      snap.forEach((doc) => {
        const d = doc.data() || {};
        categories.push({
          categoryId: doc.id,
          categoryName: String(d.categoryName || ""),
        });
      });
      categories.sort((a, b) =>
        a.categoryId.localeCompare(b.categoryId));
      sendJson(res, 200, {success: true, data: {categories}});
      return;
    }

    if (path === "/products" || path.endsWith("/products")) {
      const q = req.query || {};
      const hasDetailParam = Object.prototype.hasOwnProperty.call(
          q, "clientProductId",
      );
      const detailId = hasDetailParam ?
        String(q.clientProductId == null ? "" : q.clientProductId).trim() :
        "";

      if (hasDetailParam) {
        res.set("Cache-Control", CACHE_DETAIL);
        if (req.method === "HEAD") {
          res.status(204).send("");
          return;
        }
        if (!detailId.length) {
          sendJson(res, 400, {
            success: false,
            error: "Missing clientProductId",
          });
          return;
        }
        const detail = await loadProductDetailForRequest(detailId);
        if (detail === "missing") {
          sendJson(res, 404, {
            success: false,
            error: "Product not found",
          });
          return;
        }
        if (detail === "unavailable") {
          sendJson(res, 404, {
            success: false,
            error: "Product not available",
          });
          return;
        }
        sendJson(res, 200, {success: true, data: detail});
        return;
      }

      res.set("Cache-Control", CACHE_CATALOG);
      if (req.method === "HEAD") {
        res.status(204).send("");
        return;
      }
      const snap = await db.collection("Products")
          .where("archived", "==", false)
          .get();
      const products = [];
      const landingRefs = [];
      snap.forEach((doc) => {
        const d = doc.data() || {};
        if (d.storefrontEligible === false || !hasPricedAmount(d)) {
          return;
        }
        products.push(productToApiShape(d, doc.id));
        landingRefs.push(
            doc.ref.collection("landingContent").doc("main"),
        );
      });
      const landingSnaps = landingRefs.length ?
        await getAllDocsBatched(db, landingRefs) :
        [];
      for (let i = 0; i < products.length; i++) {
        const ls = landingSnaps[i];
        const sum = ls && ls.exists ?
          landingContentSummaryFromDoc(ls.data() || {}) :
          landingContentSummaryFromDoc({});
        products[i].landingContent = serializeValue(sum);
      }
      products.sort((a, b) =>
        String(a.clientProductId).localeCompare(String(b.clientProductId)));
      sendJson(res, 200, {
        success: true,
        data: {products: serializeValue(products)},
      });
      return;
    }

    sendJson(res, 404, {success: false, error: "Not found"});
  } catch (err) {
    logger.error("catalogHttp: internal_error", err);
    sendJson(res, 500, {success: false, error: "Internal error"});
  }
}

module.exports = {catalogHttp};
