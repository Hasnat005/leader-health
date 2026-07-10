/**
 * Leader Health Cloud Functions entrypoint.
 * Gen Health storefront only — no Dotfit, no affiliate dashboard.
 */
const {setGlobalOptions} = require("firebase-functions");
const {defineSecret} = require("firebase-functions/params");
const {onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const GEN_HEALTH_API_KEY = defineSecret("GEN_HEALTH_API_KEY");
const POSTMARK_SERVER_TOKEN = defineSecret("POSTMARK_SERVER_TOKEN");

setGlobalOptions({
  maxInstances: 10,
  secrets: [
    STRIPE_SECRET_KEY,
    GEN_HEALTH_API_KEY,
    POSTMARK_SERVER_TOKEN,
  ],
});

const {admin} = require("./utils/Firebase");
const {catalogHttp} = require("./endpoints/catalog");
const {promoValidationHttp} = require("./endpoints/promoValidation");
const {checkoutHttp} = require("./endpoints/checkout");
const {funnelHttp} = require("./endpoints/funnel.js");
const {runCatalogSync} = require("./scheduled/catalogSync");
const {syncPromoScheduled} = require("./scheduled/promoSync.js");

exports.catalogHttp = onRequest(
    {
      cors: true,
      invoker: "public",
      region: "us-central1",
      memory: "512MiB",
      maxInstances: 10,
    },
    catalogHttp,
);

exports.promoValidationHttp = onRequest(
    {
      cors: true,
      invoker: "public",
      region: "us-central1",
      memory: "512MiB",
      maxInstances: 20,
    },
    promoValidationHttp,
);

exports.checkoutHttp = onRequest(
    {
      cors: true,
      invoker: "public",
      region: "us-central1",
      memory: "512MiB",
      maxInstances: 10,
    },
    checkoutHttp,
);

exports.funnelHttp = funnelHttp;

exports.syncCatalogScheduled = onSchedule(
    {
      schedule: "every 15 minutes",
      region: "us-central1",
      timeoutSeconds: 120,
      memory: "512MiB",
      maxInstances: 1,
    },
    async () => {
      await runCatalogSync();
    },
);

exports.syncPromoScheduled = syncPromoScheduled;

exports.healthcheck = onRequest(
    {
      cors: false,
      invoker: "public",
      maxInstances: 5,
    },
    (req, res) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.set("Allow", "GET, HEAD");
        res.status(405).json({error: "method_not_allowed"});
        return;
      }
      try {
        const app = admin.app();
        const projectId =
          app.options.projectId ||
          process.env.GCLOUD_PROJECT ||
          process.env.GCP_PROJECT ||
          null;
        res.status(200).json({
          status: "ok",
          service: "leader-health",
          timestamp: new Date().toISOString(),
          projectId,
        });
      } catch (err) {
        logger.error("healthcheck_failed", {error: String(err)});
        res.status(503).json({
          status: "error",
          message: "admin_not_initialized",
        });
      }
    },
);
