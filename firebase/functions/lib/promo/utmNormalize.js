/**
 * @param {unknown} raw
 * @return {string}
 */
function normalizeUtmSlug(raw) {
  return String(raw != null ? raw : "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
}

module.exports = {normalizeUtmSlug};
