/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

/**
 * Simulated payout — no external API.
 *
 * @param {{ affiliatePayoutId: string, totalPayableCents?: number, processorType: string }} input
 * @return {Promise<{ success: boolean, ref: string }>}
 */
async function execute(input) {
  const id = String(input.affiliatePayoutId || "").slice(-12) || "unknown";
  await new Promise((r) => setTimeout(r, 200));
  return {
    success: true,
    ref: `sim_${id}`,
  };
}

module.exports = {execute};
