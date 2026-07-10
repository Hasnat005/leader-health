/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const {HttpsError} = require("firebase-functions/v2/https");

/** @type {readonly string[]} */
const ADMIN_PERMISSION_KEYS = Object.freeze([
  "analytics",
  "funnel",
  "catalog",
  "promo_codes",
  "affiliates",
  "orders",
  "commission_report",
]);

const PERMISSION_NONE = "none";
const PERMISSION_READ = "read";

const ALLOWED_LEVELS = new Set([PERMISSION_NONE, PERMISSION_READ]);

/**
 * @param {unknown} raw
 * @return {Record<string, string>}
 */
function validatePermissions(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HttpsError("invalid-argument", "permissions must be an object.");
  }
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const keys = Object.keys(obj);
  if (keys.includes("admin")) {
    throw new HttpsError("invalid-argument", "Permission key \"admin\" is not allowed.");
  }
  const unknown = keys.filter((k) => !ADMIN_PERMISSION_KEYS.includes(k));
  if (unknown.length > 0) {
    throw new HttpsError(
        "invalid-argument",
        `Unknown permission keys: ${unknown.join(", ")}.`,
    );
  }
  for (const k of ADMIN_PERMISSION_KEYS) {
    if (!(k in obj)) {
      throw new HttpsError("invalid-argument", `Missing permission key: ${k}.`);
    }
  }
  /** @type {Record<string, string>} */
  const out = {};
  for (const k of ADMIN_PERMISSION_KEYS) {
    const v = obj[k];
    if (typeof v !== "string" || !ALLOWED_LEVELS.has(v)) {
      throw new HttpsError(
          "invalid-argument",
          `Invalid level for ${k}: use "${PERMISSION_NONE}" or "${PERMISSION_READ}".`,
      );
    }
    out[k] = v;
  }
  return out;
}

module.exports = {
  ADMIN_PERMISSION_KEYS,
  PERMISSION_NONE,
  PERMISSION_READ,
  validatePermissions,
};
