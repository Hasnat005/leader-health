/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const {HttpsError} = require("firebase-functions/v2/https");

/** @type {"fixed"} */
const COMMISSION_TYPE_FIXED = "fixed";
/** @type {"percentage"} */
const COMMISSION_TYPE_PERCENTAGE = "percentage";

const MAX_COMMISSION_FIXED_CENTS = 100_000_000;

/**
 * @param {unknown} raw
 * @return {typeof COMMISSION_TYPE_FIXED | typeof COMMISSION_TYPE_PERCENTAGE}
 */
function normalizeCommissionType(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === COMMISSION_TYPE_FIXED) return COMMISSION_TYPE_FIXED;
  return COMMISSION_TYPE_PERCENTAGE;
}

/**
 * @param {unknown} n
 * @return {boolean}
 */
function commissionFixedCentsInRange(n) {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    n > 0 &&
    n <= MAX_COMMISSION_FIXED_CENTS
  );
}

/**
 * Firestore and legacy writes may store rates as strings.
 *
 * @param {unknown} raw
 * @return {number | null}
 */
function coerceCommissionRateFromFirestore(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw.trim().replace(/,/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }
  return null;
}

/**
 * @param {unknown} raw
 * @return {number | null}
 */
function coerceCommissionFixedCentsFromFirestore(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const r = Math.round(raw);
    return Number.isInteger(r) && r > 0 ? r : null;
  }
  if (typeof raw === "string") {
    const n = Math.round(Number.parseInt(raw.trim().replace(/,/g, ""), 10));
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  return null;
}

/**
 * Validate commission fields from create/edit payloads.
 *
 * @param {{
 *   commissionType: unknown,
 *   commissionRate: unknown,
 *   commissionFixedCents: unknown,
 * }} input
 */
function validateCommissionProfile(input) {
  const type = normalizeCommissionType(input.commissionType);
  if (type === COMMISSION_TYPE_FIXED) {
    const fc = input.commissionFixedCents;
    if (!commissionFixedCentsInRange(fc)) {
      throw new HttpsError(
          "invalid-argument",
          "Fixed commission must be a positive whole number of cents up to the configured maximum.",
      );
    }
    return;
  }
  const rate = input.commissionRate;
  if (rate == null) return;
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new HttpsError(
        "invalid-argument",
        "Commission rate must be between 0 and 100.",
    );
  }
}

/**
 * @param {{
 *   commissionTypeSnapshot: unknown,
 *   commissionFixedCentsSnapshot: unknown,
 *   commissionRateSnapshot: unknown,
 *   originalAmountCents: unknown,
 * }} input
 * @return {number}
 */
function computeCommissionCentsFromSnapshots(input) {
  const baseRaw = input.originalAmountCents;
  const base =
    typeof baseRaw === "number" && Number.isFinite(baseRaw) && baseRaw > 0 ?
      Math.round(baseRaw) :
      0;
  if (base <= 0) return 0;

  const commType = normalizeCommissionType(input.commissionTypeSnapshot);

  if (commType === COMMISSION_TYPE_FIXED) {
    const parsed = coerceCommissionFixedCentsFromFirestore(
        input.commissionFixedCentsSnapshot,
    );
    let fixedCents = parsed == null ? 0 : parsed;
    if (!Number.isInteger(fixedCents) || fixedCents <= 0) return 0;
    if (fixedCents > MAX_COMMISSION_FIXED_CENTS) fixedCents = MAX_COMMISSION_FIXED_CENTS;
    return Math.min(fixedCents, base);
  }

  const rate = coerceCommissionRateFromFirestore(input.commissionRateSnapshot) ?? 0;
  if (rate <= 0) return 0;
  return Math.round(base * (rate / 100));
}

module.exports = {
  COMMISSION_TYPE_FIXED,
  COMMISSION_TYPE_PERCENTAGE,
  MAX_COMMISSION_FIXED_CENTS,
  normalizeCommissionType,
  commissionFixedCentsInRange,
  coerceCommissionRateFromFirestore,
  coerceCommissionFixedCentsFromFirestore,
  validateCommissionProfile,
  computeCommissionCentsFromSnapshots,
};
