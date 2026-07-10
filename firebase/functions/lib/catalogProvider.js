/* eslint-disable valid-jsdoc, require-jsdoc */
/** @typedef {'gen_health' | 'dotfit'} CatalogProvider */

const CATALOG_PROVIDER_GEN_HEALTH = "gen_health";
const CATALOG_PROVIDER_DOTFIT = "dotfit";

const VALID = new Set([CATALOG_PROVIDER_GEN_HEALTH, CATALOG_PROVIDER_DOTFIT]);

/**
 * @param {unknown} raw
 * @return {CatalogProvider | null}
 */
function normalizeCatalogProvider(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === CATALOG_PROVIDER_DOTFIT || s === "dotfit") {
    return CATALOG_PROVIDER_DOTFIT;
  }
  if (
    s === CATALOG_PROVIDER_GEN_HEALTH ||
    s === "gen_health" ||
    s === "genhealth"
  ) {
    return CATALOG_PROVIDER_GEN_HEALTH;
  }
  return null;
}

/**
 * Legacy dotFit products may only have `source: 'dotfit'`.
 * @param {Record<string, unknown> | null | undefined} data
 * @return {CatalogProvider | null}
 */
function catalogProviderFromProductData(data) {
  const d = data && typeof data === "object" ? data : {};
  const fromField = normalizeCatalogProvider(d.catalog_provider);
  if (fromField) return fromField;
  if (String(d.source || "").trim().toLowerCase() === "dotfit") {
    return CATALOG_PROVIDER_DOTFIT;
  }
  return null;
}

/**
 * @param {unknown} raw
 * @param {CatalogProvider} fallback
 * @return {CatalogProvider}
 */
function requireCatalogProvider(raw, fallback) {
  return normalizeCatalogProvider(raw) || fallback;
}

module.exports = {
  CATALOG_PROVIDER_GEN_HEALTH,
  CATALOG_PROVIDER_DOTFIT,
  VALID,
  normalizeCatalogProvider,
  catalogProviderFromProductData,
  requireCatalogProvider,
};
