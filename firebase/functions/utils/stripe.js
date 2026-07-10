/* eslint-disable valid-jsdoc, require-jsdoc */
const createStripeClient = require("stripe");
const config = require("../config.js");

/**
 * Returns a configured Stripe client. Throws if stripeSecretKey is not set.
 * Call lazily (inside handlers) rather than at module load so missing keys
 * only fail at request time, not at cold-start import.
 */
function getStripe() {
  const key = (
    process.env.STRIPE_SECRET_KEY || config.stripeSecretKey || ""
  ).trim();
  if (!key) {
    throw new Error(
        "stripeSecretKey is not set. Set STRIPE_SECRET_KEY in Secret Manager " +
        "or STRIPE_SECRET_KEY in firebase/functions/.env for local emulator.",
    );
  }
  return createStripeClient(key);
}

module.exports = {getStripe};
/* eslint-enable valid-jsdoc, require-jsdoc */
