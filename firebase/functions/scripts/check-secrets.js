/* eslint-disable max-len, require-jsdoc, operator-linebreak */
/**
 * Diagnostic: verify every secret used by Cloud Functions is accessible
 * from both the staging and production projects.
 *
 * Usage (from firebase/functions/):
 *   node scripts/check-secrets.js
 *
 * What it checks per project:
 *  - Secret exists in Secret Manager
 *  - Has at least one version
 *  - Latest version is ENABLED (not destroyed/disabled)
 *  - The service account used here can access the payload (actual value read)
 *
 * The script uses:
 *  - STAGING  → firebaseStagingServiceAccount from ../config.js
 *  - PROD     → firebaseServiceAccount from ../config.js (prod Admin SDK SA)
 *
 * Neither SA is the runtime compute SA, so a passing result here means the
 * secret is accessible to *an* admin SA. If the compute SA differs, also
 * grant roles/secretmanager.secretAccessor to:
 *   staging: 897083051710-compute@developer.gserviceaccount.com
 *   prod:    304158112669-compute@developer.gserviceaccount.com
 */

"use strict";

const https = require("https");

// ---------------------------------------------------------------------------
// Service accounts
// ---------------------------------------------------------------------------

const {
  firebaseServiceAccount: PROD_SA,
  firebaseStagingServiceAccount: STAGING_SA,
} = require("../config.js");

// ---------------------------------------------------------------------------
// Secrets to check (must match defineSecret() names in index.js)
// ---------------------------------------------------------------------------

const SECRET_NAMES = [
  "STRIPE_SECRET_KEY",
  "POSTMARK_SERVER_TOKEN",
  "GEN_HEALTH_API_KEY",
  "DOTFIT_CLUB_GUID",
  "DOTFIT_WEB_SERVICES_PASSWORD",
  "DOTFIT_WHOLESALE_USER_ID",
  "GA4_SA_JSON_BASE64",
  "GA4_PROPERTY_ID",
];

// ---------------------------------------------------------------------------
// Minimal JWT / OAuth2 implementation (no external deps)
// ---------------------------------------------------------------------------

const crypto = require("crypto");

function toBase64Url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function makeJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(Buffer.from(JSON.stringify({alg: "RS256", typ: "JWT"})));
  const payload = toBase64Url(Buffer.from(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/cloud-platform",
  })));
  const signing = `${header}.${payload}`;
  const sig = toBase64Url(
      crypto.createSign("RSA-SHA256").update(signing).sign(sa.private_key),
  );
  return `${signing}.${sig}`;
}

function httpsPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(body);
    const req = https.request({
      hostname, path, method: "POST",
      headers: {"Content-Type": "application/x-www-form-urlencoded", "Content-Length": data.length},
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try {
          resolve({status: res.statusCode, body: JSON.parse(raw)});
        } catch {
          resolve({status: res.statusCode, body: raw});
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function httpsGet(hostname, path, token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path, method: "GET",
      headers: {Authorization: `Bearer ${token}`},
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try {
          resolve({status: res.statusCode, body: JSON.parse(raw)});
        } catch {
          resolve({status: res.statusCode, body: raw});
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function getAccessToken(sa) {
  const jwt = makeJwt(sa);
  const res = await httpsPost(
      "oauth2.googleapis.com",
      "/token",
      `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  );
  if (res.status !== 200 || !res.body.access_token) {
    throw new Error(`OAuth2 failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.access_token;
}

// ---------------------------------------------------------------------------
// Secret Manager helpers
// ---------------------------------------------------------------------------

const SM_HOST = "secretmanager.googleapis.com";

async function getSecretMetadata(token, project, name) {
  return httpsGet(SM_HOST, `/v1/projects/${project}/secrets/${name}`, token);
}

async function getLatestSecretVersion(token, project, name) {
  return httpsGet(SM_HOST, `/v1/projects/${project}/secrets/${name}/versions/latest`, token);
}

async function accessSecretPayload(token, project, name) {
  return httpsGet(SM_HOST, `/v1/projects/${project}/secrets/${name}/versions/latest:access`, token);
}

// ---------------------------------------------------------------------------
// Per-project check
// ---------------------------------------------------------------------------

async function checkProject(label, sa, project) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${label} — ${project}`);
  console.log(`  Service account: ${sa.client_email}`);
  console.log("=".repeat(60));

  let token;
  try {
    token = await getAccessToken(sa);
    console.log("  ✓ OAuth2 token obtained\n");
  } catch (e) {
    console.error(`  ✗ Failed to get OAuth2 token: ${e.message}`);
    return;
  }

  for (const name of SECRET_NAMES) {
    process.stdout.write(`  ${name.padEnd(35)}`);

    // 1. Does the secret exist?
    const meta = await getSecretMetadata(token, project, name);
    if (meta.status === 404) {
      console.log("✗ NOT FOUND in Secret Manager");
      continue;
    }
    if (meta.status !== 200) {
      console.log(`✗ metadata error (HTTP ${meta.status})`);
      continue;
    }

    // 2. Does a 'latest' version exist?
    const ver = await getLatestSecretVersion(token, project, name);
    if (ver.status === 404) {
      console.log("✗ secret exists but has NO VERSION");
      continue;
    }
    if (ver.status !== 200) {
      console.log(`✗ version fetch error (HTTP ${ver.status})`);
      continue;
    }

    const state = ver.body.state || "UNKNOWN";
    if (state !== "ENABLED") {
      console.log(`✗ latest version state: ${state} (not ENABLED)`);
      continue;
    }

    // 3. Can we read the payload?
    const payload = await accessSecretPayload(token, project, name);
    if (payload.status !== 200) {
      console.log(`✗ ENABLED but cannot read payload (HTTP ${payload.status}) — IAM missing?`);
      continue;
    }

    const val = payload.body.payload && payload.body.payload.data
      ? Buffer.from(payload.body.payload.data, "base64").toString("utf8").trim()
      : "";

    if (!val) {
      console.log("✗ payload is empty string — secret has no value");
      continue;
    }

    console.log(`✓ OK (${val.length} chars, starts: ${val.slice(0, 6)}…)`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  try {
    await checkProject("STAGING", STAGING_SA, "staging-nxgenrx");
    await checkProject("PRODUCTION", PROD_SA, "nex-gen-cd81c");
    console.log("\nDone.\n");
  } catch (e) {
    console.error("\nFatal:", e.message);
    process.exit(1);
  }
})();
