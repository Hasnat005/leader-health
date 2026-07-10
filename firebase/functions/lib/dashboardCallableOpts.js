/* eslint-disable max-len -- short reference doc in header */
/**
 * Shared Gen2 `onCall` options for HTTPS functions invoked from the dashboard SPA.
 *
 * Gen2 callables run on Cloud Run. The client sends an unauthenticated OPTIONS preflight
 * before the POST that carries the Firebase ID token. The Cloud Run service must allow
 * unauthenticated IAM invocation (`roles/run.invoker` for `allUsers`), or preflight
 * returns 403 ("Empty Authorization header") before your function runs.
 *
 * `invoker: "public"` sets Cloud Run IAM so browser OPTIONS preflight can succeed; auth is
 * still enforced in each handler via `request.auth`.
 *
 * To add the deployed dashboard domain, set DASHBOARD_ORIGIN env var or append a regex
 * to dashboardCorsList below.
 */

/**
 * Build CORS list from env + localhost defaults.
 * Set DASHBOARD_ORIGIN (exact origin, e.g. https://your-app.netlify.app) to add the
 * deployed dashboard URL without hardcoding it here.
 *
 * @return {Array<string|RegExp>}
 */
function dashboardHttpCorsList() {
  const list = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    // Deployed dashboard (production + Netlify preview/branch deploys).
    "https://afflynk.netlify.app",
    /^https:\/\/[a-z0-9-]+--afflynk\.netlify\.app$/,
  ];
  const deployedOrigin = (process.env.DASHBOARD_ORIGIN || "").trim();
  if (deployedOrigin) list.push(deployedOrigin);
  return list;
}

const dashboardCallableGen2 = {
  region: "us-central1",
  invoker: "public",
  enforceAppCheck: false,
  cors: dashboardHttpCorsList(),
};

module.exports = {
  dashboardCallableGen2,
  dashboardHttpCorsList,
};
