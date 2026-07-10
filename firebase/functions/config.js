/**
 * Leader Health Cloud Functions config.
 * Secrets via defineSecret() in index.js → process.env at runtime.
 */

const firebaseServiceAccount = {
  type: "service_account",
  project_id: "leader-health-staging",
  private_key_id: "",
  private_key: "",
  client_email: "",
  client_id: "",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "",
  universe_domain: "googleapis.com",
};

const firebaseStagingServiceAccount = {
  ...firebaseServiceAccount,
  project_id: "leader-health-staging",
};

const firebaseProductionServiceAccount = {
  ...firebaseServiceAccount,
  project_id: "leader-health-prod",
};

const stripeSecretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
const postmarkServerToken = (process.env.POSTMARK_SERVER_TOKEN || "").trim();

const genHealthPublicApiBaseUrl = (
  process.env.GEN_HEALTH_PUBLIC_API_BASE_URL || "https://api.gen-health.app"
).trim().replace(/\/$/, "");

const genHealthApi = {
  publicApiBaseUrl: genHealthPublicApiBaseUrl,
  clientPatientsUrl:
    "https://us-central1-gen-telehealth.cloudfunctions.net/clientPatients",
  apiKey: (process.env.GEN_HEALTH_API_KEY || "").trim(),
};

const genHealthRequestConsultApiOrdersEnabled =
  process.env.GEN_HEALTH_REQUEST_CONSULT_API_ORDERS_ENABLED === "true" ||
  process.env.GEN_HEALTH_REQUEST_CONSULT_API_ORDERS === "true";

const attributionAllowNoPromoUtm =
  process.env.ATTRIBUTION_ALLOW_NO_PROMO_UTM === "true";

const storefrontBaseUrl =
  (process.env.STOREFRONT_BASE_URL || "https://www.myleaderhealth.com").replace(
      /\/$/,
      "",
  );

module.exports = {
  firebaseServiceAccount,
  firebaseStagingServiceAccount,
  firebaseProductionServiceAccount,
  genHealthApi,
  stripeSecretKey,
  postmarkServerToken,
  attributionAllowNoPromoUtm,
  genHealthRequestConsultApiOrdersEnabled,
  storefrontBaseUrl,
};
