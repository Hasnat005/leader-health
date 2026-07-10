/* eslint-disable require-jsdoc, max-len */
/**
 * Dump a PromoCodes doc from staging (or pass --project).
 *
 *   node scripts/dumpPromoCode.js GG
 *   node scripts/dumpPromoCode.js GG --project staging-nxgenrx
 */

const admin = require("firebase-admin");
const {firebaseStagingServiceAccount} = require("../config.js");

const code = (process.argv[2] || "").trim().toUpperCase();
if (!code) {
  console.error("Usage: node scripts/dumpPromoCode.js <PROMO_CODE>");
  process.exit(1);
}

/**
 * @param {*} value
 * @return {*}
 */
function serialize(value) {
  if (value == null) return value;
  if (typeof value.toDate === "function") {
    return {_type: "Timestamp", iso: value.toDate().toISOString()};
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = serialize(v);
    }
    return out;
  }
  return value;
}

async function main() {
  const projectId = firebaseStagingServiceAccount.project_id;
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseStagingServiceAccount),
    });
  }
  const db = admin.firestore();
  const [promoSnap, syncSnap] = await Promise.all([
    db.collection("PromoCodes").doc(code).get(),
    db.collection("SyncState").doc("promocodes").get(),
  ]);
  const data = promoSnap.exists ? promoSnap.data() : null;
  const dump = {
    project: projectId,
    promoCode: code,
    exists: promoSnap.exists,
    document: data ? serialize({id: promoSnap.id, ...data}) : null,
    syncState_promocodes: syncSnap.exists ? serialize(syncSnap.data()) : null,
    scopeFields: data ? {
      appliesTo: data.appliesTo,
      productIds: data.productIds,
      categoryIds: data.categoryIds,
      genHealthEligibleClientProductIds: data.genHealthEligibleClientProductIds,
      eligibleProductIdsNotInCatalog: data.eligibleProductIdsNotInCatalog,
    } : null,
  };
  console.log(JSON.stringify(dump, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
