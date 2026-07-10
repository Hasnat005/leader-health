/* eslint-disable no-console, max-len */
/**
 * Upload the dashboard logo to Firebase Storage and make it publicly readable
 * so it can be referenced as <img src=…> from Postmark password-reset emails.
 *
 * Source: dashboard/public/nxgen-logo.png (repo path).
 * Destination: gs://{BUCKET}/email-assets/nxgen-logo.png.
 *
 * Usage (from firebase/functions):
 *   node scripts/upload-email-logo.js
 *   STORAGE_BUCKET=nex-gen-cd81c.appspot.com node scripts/upload-email-logo.js
 *
 * After uploading, copy the printed public URL into the LOGO_URL constant in
 * utils/postmark.js. Idempotent — re-running just overwrites the existing
 * object and re-marks it public.
 */

const fs = require("fs");
const path = require("path");
const {storage} = require("../utils/Firebase");

const DEFAULT_BUCKET = "nex-gen-cd81c.firebasestorage.app";
const LEGACY_BUCKET = "nex-gen-cd81c.appspot.com";
const SOURCE_REL = path.join(
    "..", "..", "..", "dashboard", "public", "nxgen-logo.png",
);
const DEST_OBJECT = "email-assets/nxgen-logo.png";

/**
 * @param {string} bucketName
 * @return {Promise<string>} public URL
 */
async function uploadTo(bucketName) {
  const bucket = storage.bucket(bucketName);
  const sourcePath = path.resolve(__dirname, SOURCE_REL);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  await bucket.upload(sourcePath, {
    destination: DEST_OBJECT,
    metadata: {
      contentType: "image/png",
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  const file = bucket.file(DEST_OBJECT);
  await file.makePublic();

  return `https://storage.googleapis.com/${bucketName}/${DEST_OBJECT}`;
}

/**
 * Tries the env-supplied bucket first, otherwise the default and legacy
 * Firebase Storage bucket names for this project.
 *
 * @return {Promise<void>}
 */
async function main() {
  const envBucket = (process.env.STORAGE_BUCKET || "").trim();
  const candidates = envBucket ?
    [envBucket] :
    [DEFAULT_BUCKET, LEGACY_BUCKET];

  let lastErr = null;
  for (const bucketName of candidates) {
    try {
      console.log(`Uploading to gs://${bucketName}/${DEST_OBJECT} …`);
      const publicUrl = await uploadTo(bucketName);
      console.log("");
      console.log("Upload OK. Public URL:");
      console.log(publicUrl);
      console.log("");
      console.log("Paste this into LOGO_URL in firebase/functions/utils/postmark.js.");
      return;
    } catch (err) {
      lastErr = err;
      console.error(`Failed on bucket ${bucketName}: ${err && err.message ? err.message : err}`);
    }
  }
  throw lastErr || new Error("Upload failed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
