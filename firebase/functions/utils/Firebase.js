/**
 * Single place to load config and initialize Firebase Admin SDK services.
 * Requires ../config.js exporting { firebaseServiceAccount, ... }.
 *
 * Deployed Gen2 functions (Cloud Run): use Application Default Credentials for
 * the *current* project (GCLOUD_PROJECT). Do not use the embedded service
 * account from config.js — it is prod-only and would send staging traffic to
 * production Firestore if used as credential.cert().
 *
 * Local scripts / emulator: use firebaseServiceAccount from config when
 * present.
 */

const admin = require("firebase-admin");
const {getFirestore} = require("firebase-admin/firestore");
const {getAuth} = require("firebase-admin/auth");
const {getStorage} = require("firebase-admin/storage");

const {firebaseServiceAccount} = require("../config");

/**
 * True when this process is a hosted Cloud Function (Gen2 / Cloud Run), not
 * the Functions emulator and not an arbitrary local Node script.
 * @return {boolean}
 */
function isHostedCloudFunctionRuntime() {
  if (process.env.FUNCTIONS_EMULATOR === "true") return false;
  return Boolean(process.env.K_SERVICE || process.env.FUNCTION_TARGET);
}

/**
 * @param {Object|undefined|null} sa Firebase service account object.
 * @return {boolean}
 */
function hasServiceAccountCredentials(sa) {
  return Boolean(
      sa &&
    typeof sa === "object" &&
    sa.project_id &&
    sa.private_key,
  );
}

/**
 * Firebase Storage bucket host for this project.
 * New projects use `{projectId}.firebasestorage.app`; legacy may use
 * `{projectId}.appspot.com`. Override with `FIREBASE_STORAGE_BUCKET`.
 *
 * @param {string} projectId
 * @return {string}
 */
function defaultStorageBucketForProject(projectId) {
  const pid = String(projectId || "").trim();
  if (!pid) return "";
  return `${pid}.firebasestorage.app`;
}

/**
 * @return {string}
 */
function resolveStorageBucket() {
  const fromEnv = (process.env.FIREBASE_STORAGE_BUCKET || "").trim();
  if (fromEnv) return fromEnv;
  const gcpProject =
    (process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "").trim();
  if (gcpProject) return defaultStorageBucketForProject(gcpProject);
  if (hasServiceAccountCredentials(firebaseServiceAccount)) {
    return defaultStorageBucketForProject(
        String(firebaseServiceAccount.project_id || ""),
    );
  }
  return "";
}

if (!admin.apps.length) {
  const storageBucket = resolveStorageBucket();
  const projectId =
    (process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "").trim();

  if (isHostedCloudFunctionRuntime()) {
    /** ADC — project is the Firebase project this function is deployed to. */
    const opts = {};
    if (projectId) opts.projectId = projectId;
    if (storageBucket) opts.storageBucket = storageBucket;
    admin.initializeApp(Object.keys(opts).length ? opts : undefined);
  } else if (hasServiceAccountCredentials(firebaseServiceAccount)) {
    const opts = {
      credential: admin.credential.cert(firebaseServiceAccount),
    };
    if (storageBucket) opts.storageBucket = storageBucket;
    admin.initializeApp(opts);
  } else if (storageBucket) {
    admin.initializeApp({storageBucket});
  } else {
    admin.initializeApp();
  }
}

const db = getFirestore();
const auth = getAuth();
const storage = getStorage();

module.exports = {
  admin,
  db,
  auth,
  storage,
};
