/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

/**
 * Pure string normalisers — no Firestore or network deps.
 * Extended from the original single-function module to expose all helpers
 * required by lib/checkout/attribution.js and lib/promo/affiliate.js.
 */

/**
 * @param {string | null | undefined} raw
 * @return {string}
 */
function normalizePromoCodeId(raw) {
  if (raw == null || typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

/**
 * @param {string | null | undefined} raw
 * @return {string}
 */
function normalizeUtmSlug(raw) {
  return String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
}

/**
 * @param {unknown} raw
 * @return {'locked' | 'shared'}
 */
function normalizePromoState(raw) {
  return raw === "shared" ? "shared" : "locked";
}

/**
 * @param {string} promoCodeId
 * @param {string} affiliateId
 * @return {string}
 */
function promoAssignmentDocId(promoCodeId, affiliateId) {
  return `${String(promoCodeId).trim()}::${String(affiliateId).trim()}`;
}

/**
 * Parse and normalise the attributionSnapshot sent by the storefront cookie.
 *
 * Accepts two shapes:
 *   - { rawUtm: { source, medium, campaign }, capturedAtMs? }
 *   - flat { utmSource, utmMedium, utmCampaign, capturedAtMs? }
 *
 * @param {unknown} snap
 * @return {{ source: string, medium: string, campaign: string, capturedAtMs: number | null }}
 */
function parseClientAttributionSnapshot(snap) {
  if (!snap || typeof snap !== "object") {
    return {source: "", medium: "", campaign: "", capturedAtMs: null};
  }
  const o = /** @type {Record<string, unknown>} */ (snap);
  const raw =
    o.rawUtm && typeof o.rawUtm === "object" ?
      /** @type {Record<string, unknown>} */ (o.rawUtm) :
      o;
  const source =
    typeof raw.utmSource === "string" ? raw.utmSource :
      typeof raw.source === "string" ? raw.source : "";
  const medium =
    typeof raw.utmMedium === "string" ? raw.utmMedium :
      typeof raw.medium === "string" ? raw.medium : "";
  const campaign =
    typeof raw.utmCampaign === "string" ? raw.utmCampaign :
      typeof raw.campaign === "string" ? raw.campaign : "";
  let capturedAtMs = null;
  if (typeof o.capturedAtMs === "number" && Number.isFinite(o.capturedAtMs)) {
    capturedAtMs = o.capturedAtMs;
  } else if (typeof o.capturedAt === "number" && Number.isFinite(o.capturedAt)) {
    capturedAtMs = o.capturedAt;
  } else if (typeof o.capturedAt === "string" && o.capturedAt.trim()) {
    const t = Date.parse(o.capturedAt);
    if (Number.isFinite(t)) capturedAtMs = t;
  }
  return {
    source: String(source || "").trim(),
    medium: String(medium || "").trim().toLowerCase(),
    campaign: String(campaign || "").trim(),
    capturedAtMs,
  };
}

module.exports = {
  normalizePromoCodeId,
  normalizeUtmSlug,
  normalizePromoState,
  promoAssignmentDocId,
  parseClientAttributionSnapshot,
};

/* eslint-enable valid-jsdoc, max-len, require-jsdoc */
