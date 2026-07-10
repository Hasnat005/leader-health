/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const simulated = require("./simulatedAdapter.js");
const stripe = require("./stripeAdapter.js");
const paypal = require("./paypalAdapter.js");

/**
 * @param {string} processorType
 */
function getAdapter(processorType) {
  const t = String(processorType || "").toLowerCase();
  if (t === "stripe") return stripe;
  if (t === "paypal") return paypal;
  return simulated;
}

module.exports = {getAdapter};
