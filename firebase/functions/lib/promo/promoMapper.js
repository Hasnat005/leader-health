/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

/** Bump when Firestore mapping rules change (forces promo resync even if GH list unchanged). */
const PROMO_MAPPER_SYNC_VERSION = 2;

const admin = require("firebase-admin");
const {sha1Hex, stableStringify} = require("../../utils/hash.js");

/**
 * @param {unknown} raw
 * @return {string}
 */
function normalizeCodeFromApi(raw) {
  const code =
    typeof raw?.normalizedCode === "string" && raw.normalizedCode.trim() ?
      raw.normalizedCode.trim() :
      typeof raw?.code === "string" && raw.code.trim() ?
        raw.code.trim() :
        "";
  return code.toUpperCase();
}

/**
 * @param {unknown} assignmentType
 * @return {'locked' | 'shared' | 'generic'}
 */
function mapAssignmentState(assignmentType) {
  if (assignmentType === "locked") return "locked";
  if (assignmentType === "shared") return "shared";
  return "generic";
}

/**
 * @param {unknown} discount
 * @return {{ discountType: string, discountValue: number }}
 */
function mapDiscount(discount) {
  const d = discount && typeof discount === "object" ? discount : {};
  const type = typeof d.type === "string" ? d.type : "";
  const value =
    typeof d.value === "number" && Number.isFinite(d.value) ? d.value : 0;
  if (type === "amount_off") return {discountType: "fixed", discountValue: value};
  if (type === "set_price") return {discountType: "set_price", discountValue: value};
  return {discountType: "percentage", discountValue: value};
}

/**
 * Collect eligible client product ids verbatim from the GH promocode payload.
 * We do not infer scope from applicability.scope (e.g. all_products).
 *
 * @param {Record<string, unknown>} raw
 * @return {string[]}
 */
function eligibleClientProductIdsFromGh(raw) {
  if (!Array.isArray(raw.eligibleClientProductIds)) return [];
  return [
    ...new Set(
        raw.eligibleClientProductIds
            .map((x) => String(x || "").trim())
            .filter(Boolean),
    ),
  ];
}

/**
 * Mirror GH eligible products intersected with synced Gen Health catalog.
 * Always appliesTo "products" — never "all" from GH sync.
 *
 * @param {Record<string, unknown>} raw
 * @param {Set<string>|null|undefined} catalogClientProductIds
 * @return {{
 *   appliesTo: 'products',
 *   categoryIds: [],
 *   productIds: string[],
 *   genHealthEligibleClientProductIds: string[],
 *   eligibleProductIdsNotInCatalog: string[],
 * }}
 */
function mapEligibleProductsFromGh(raw, catalogClientProductIds) {
  const ghEligible = eligibleClientProductIdsFromGh(raw);
  const catalog =
    catalogClientProductIds instanceof Set ? catalogClientProductIds : new Set();

  const productIds = ghEligible.filter((id) => catalog.has(id));
  const eligibleProductIdsNotInCatalog = ghEligible.filter((id) => !catalog.has(id));

  return {
    appliesTo: "products",
    categoryIds: [],
    productIds,
    genHealthEligibleClientProductIds: ghEligible,
    eligibleProductIdsNotInCatalog,
  };
}

/**
 * @param {unknown} validity
 * @return {admin.firestore.Timestamp | null}
 */
function mapExpiresAt(validity) {
  if (!validity || typeof validity !== "object") return null;
  const v = /** @type {Record<string, unknown>} */ (validity);
  const endsAt = v.endsAt;
  if (endsAt == null) return null;
  if (typeof endsAt === "string" && endsAt.trim()) {
    const ms = Date.parse(endsAt);
    if (Number.isFinite(ms)) return admin.firestore.Timestamp.fromMillis(ms);
  }
  if (typeof endsAt === "object" && endsAt !== null) {
    const o = /** @type {{ _seconds?: number, toDate?: () => Date }} */ (endsAt);
    if (typeof o._seconds === "number") {
      return admin.firestore.Timestamp.fromMillis(o._seconds * 1000);
    }
    if (typeof o.toDate === "function") {
      return admin.firestore.Timestamp.fromDate(o.toDate());
    }
  }
  return null;
}

/**
 * @param {Record<string, unknown>} fields
 * @return {Record<string, unknown>}
 */
function promoHashPayload(fields) {
  return {
    code: fields.code,
    name: fields.name,
    status: fields.status,
    discountType: fields.discountType,
    discountValue: fields.discountValue,
    appliesTo: fields.appliesTo,
    categoryIds: fields.categoryIds,
    productIds: fields.productIds,
    genHealthEligibleClientProductIds: fields.genHealthEligibleClientProductIds,
    eligibleProductIdsNotInCatalog: fields.eligibleProductIdsNotInCatalog,
    state: fields.state,
    usageLimit: fields.usageLimit,
    usageCount: fields.usageCount,
    validity: fields.validity,
    affiliatesSnapshot: fields.affiliatesSnapshot,
    genHealthPromocodeId: fields.genHealthPromocodeId,
    archived: fields.archived,
  };
}

/**
 * @param {Record<string, unknown>} raw Gen-Health promocode API object
 * @param {boolean} archived
 * @param {Set<string>|null|undefined} catalogClientProductIds Synced Products ids
 * @return {{ code: string, fields: Record<string, unknown>, hashPayload: Record<string, unknown> }}
 */
function mapPromocodeFromApi(raw, archived = false, catalogClientProductIds = null) {
  const code = normalizeCodeFromApi(raw);
  if (!code) {
    throw new Error("mapPromocodeFromApi: missing normalizedCode/code");
  }

  const {discountType, discountValue} = mapDiscount(raw.discount);
  const {
    appliesTo,
    categoryIds,
    productIds,
    genHealthEligibleClientProductIds,
    eligibleProductIdsNotInCatalog,
  } = mapEligibleProductsFromGh(raw, catalogClientProductIds);
  const state = mapAssignmentState(raw.assignmentType);
  const usageLimit =
    raw.maxUsage != null && typeof raw.maxUsage === "number" && Number.isFinite(raw.maxUsage) ?
      Math.round(raw.maxUsage) :
      null;
  const usageCount =
    typeof raw.usageCount === "number" && Number.isFinite(raw.usageCount) ?
      Math.round(raw.usageCount) :
      0;
  const status = raw.status === "inactive" ? "inactive" : "active";
  const validity =
    raw.validity && typeof raw.validity === "object" ?
      raw.validity :
      {startsAt: null, endsAt: null};
  const affiliatesSnapshot = Array.isArray(raw.affiliates) ? raw.affiliates : [];
  const name =
    typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : null;
  const genHealthPromocodeId =
    typeof raw.promocodeId === "string" && raw.promocodeId.trim() ?
      raw.promocodeId.trim() :
      null;

  const fields = {
    code,
    name,
    status,
    discountType,
    discountValue,
    appliesTo,
    categoryIds,
    productIds,
    genHealthEligibleClientProductIds,
    eligibleProductIdsNotInCatalog,
    state,
    usageLimit,
    usageCount,
    validity,
    expiresAt: mapExpiresAt(validity),
    affiliatesSnapshot,
    genHealthPromocodeId,
    archived: Boolean(archived),
    source: "gen_health",
    catalog_provider: "gen_health",
  };

  return {
    code,
    fields,
    hashPayload: promoHashPayload(fields),
  };
}

/**
 * @param {Record<string, unknown>} hashPayload
 * @return {string}
 */
function promoHash(hashPayload) {
  return sha1Hex(stableStringify(hashPayload));
}

module.exports = {
  PROMO_MAPPER_SYNC_VERSION,
  mapPromocodeFromApi,
  mapEligibleProductsFromGh,
  eligibleClientProductIdsFromGh,
  promoHash,
  promoHashPayload,
  normalizeCodeFromApi,
};
