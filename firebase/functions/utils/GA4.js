const {BetaAnalyticsDataClient} = require("@google-analytics/data");
const {ga4ServiceAccount} = require("../config.js");

/** @type {BetaAnalyticsDataClient | null} */
let analyticsClient = null;

/**
 * Returns a GA4 Data API client using credentials from config,
 * or null if not configured.
 * @return {BetaAnalyticsDataClient | null}
 */
function getAnalyticsClient() {
  if (
    !ga4ServiceAccount ||
    typeof ga4ServiceAccount !== "object" ||
    !ga4ServiceAccount.private_key ||
    !ga4ServiceAccount.client_email
  ) {
    return null;
  }
  if (!analyticsClient) {
    analyticsClient = new BetaAnalyticsDataClient({
      credentials: ga4ServiceAccount,
    });
  }
  return analyticsClient;
}

module.exports = {getAnalyticsClient};
