/**
 * Deterministic JSON + SHA-1 helpers for catalog sync hashing.
 */

const crypto = require("crypto");

/**
 * @param {*} value
 * @return {string}
 */
function stableStringify(value) {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (typeof value.toMillis === "function") {
    return JSON.stringify(value.toMillis());
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return "{" + keys.map((k) => {
      return JSON.stringify(k) + ":" + stableStringify(value[k]);
    }).join(",") + "}";
  }
  return JSON.stringify(String(value));
}

/**
 * @param {string} s
 * @return {string}
 */
function sha1Hex(s) {
  return crypto.createHash("sha1").update(s, "utf8").digest("hex");
}

/**
 * @param {Array<*>} items
 * @param {number} chunkSize
 * @return {Array<Array<*>>}
 */
function chunkBatches(items, chunkSize = 500) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

module.exports = {stableStringify, sha1Hex, chunkBatches};
