/* eslint-disable valid-jsdoc, require-jsdoc, camelcase, max-len */
const {db} = require("../../../utils/Firebase.js");
const {CATALOG_PROVIDER_GEN_HEALTH} = require("../../catalogProvider.js");

/**
 * @param {string} clientProductId
 * @return {Promise<{
 *   catalog_provider: 'gen_health',
 *   client_product_id: string,
 *   product_name: string,
 *   amount_cents: number,
 *   currency: string,
 *   errors: string[],
 *   steps: Record<string, boolean>,
 * }>}
 */
async function bootstrapGenHealthCheckout(clientProductId) {
  const id = String(clientProductId || "").trim();
  const errors = [];
  if (!id) {
    return {
      catalog_provider: CATALOG_PROVIDER_GEN_HEALTH,
      client_product_id: "",
      product_name: "",
      amount_cents: 0,
      currency: "usd",
      errors: ["productId is required."],
      steps: {
        details: true,
        screening: true,
        consult: true,
        promo: true,
        shipping: false,
        payment: true,
      },
    };
  }

  const snap = await db.collection("Products").doc(id).get();
  if (!snap.exists || snap.get("archived") === true) {
    errors.push("Product not found.");
  } else if (snap.get("storefrontEligible") === false) {
    errors.push("Product is not available on the storefront.");
  }

  const data = snap.exists ? snap.data() || {} : {};
  const pricing = data.pricing && typeof data.pricing === "object" ? data.pricing : {};
  const amount_cents =
    typeof pricing.amount === "number" && pricing.amount > 0 ?
      Math.round(pricing.amount) :
      0;
  if (snap.exists && amount_cents <= 0) {
    errors.push("Product has no price.");
  }

  return {
    catalog_provider: CATALOG_PROVIDER_GEN_HEALTH,
    client_product_id: id,
    product_name: String(data.displayName || data.name || id),
    amount_cents,
    currency: String(pricing.currency || "usd").toLowerCase(),
    errors,
    steps: {
      details: true,
      screening: true,
      consult: true,
      promo: true,
      shipping: false,
      payment: true,
    },
  };
}

module.exports = {bootstrapGenHealthCheckout};
