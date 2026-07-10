/* eslint-disable valid-jsdoc, require-jsdoc */
const admin = require("firebase-admin");
const {
  CATALOG_PROVIDER_GEN_HEALTH,
  normalizeCatalogProvider,
} = require("../catalogProvider.js");

/**
 * Persist catalog_provider on PromoCodes when missing (lazy backfill).
 * @param {FirebaseFirestore.DocumentReference} ref
 * @param {FirebaseFirestore.DocumentData | undefined} data
 * @return {Promise<'gen_health' | 'dotfit'>}
 */
async function ensurePromoCatalogProviderOnRead(ref, data) {
  const d = data && typeof data === "object" ? data : {};
  const existing = normalizeCatalogProvider(d.catalog_provider);
  if (existing) return existing;
  const legacySource = String(d.source || "").trim().toLowerCase();
  const inferred =
    legacySource === "dotfit" ?
      "dotfit" :
      CATALOG_PROVIDER_GEN_HEALTH;
  await ref.set(
      {
        catalog_provider: inferred,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
  );
  return inferred;
}

module.exports = {ensurePromoCatalogProviderOnRead};
