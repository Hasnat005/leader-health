/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const simulated = require("./simulatedAdapter.js");

/** @param {Parameters<typeof simulated.execute>[0]} input */
async function execute(input) {
  const out = await simulated.execute(input);
  return {
    ...out,
    ref: typeof out.ref === "string" ? `paypal_sim_${out.ref.replace(/^sim_/, "")}` : out.ref,
  };
}

module.exports = {execute};
