/* eslint-disable valid-jsdoc, max-len, require-jsdoc */
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const {db} = require("../utils/Firebase.js");
const {sha1Hex, stableStringify} = require("../utils/hash.js");
const {fetchPromocodes} = require("../utils/genHealthApi.js");
const {syncPromos} = require("../lib/promo/syncPromos.js");
const {
  normalizeCodeFromApi,
  PROMO_MAPPER_SYNC_VERSION,
} = require("../lib/promo/promoMapper.js");

const SYNC_STATE_ID = "promocodes";

/**
 * @param {Array<Record<string, unknown>>} promos
 * @return {string}
 */
function computeApiHash(promos) {
  const sorted = [...promos].sort((a, b) => {
    const ac = normalizeCodeFromApi(a);
    const bc = normalizeCodeFromApi(b);
    return ac.localeCompare(bc);
  });
  return sha1Hex(stableStringify(sorted));
}

async function run() {
  logger.info("promoSync: run started");
  const stateRef = db.collection("SyncState").doc(SYNC_STATE_ID);

  let promos;
  try {
    promos = await fetchPromocodes();
    logger.info("promoSync: promocodes fetched", {count: promos.length});
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    logger.error("promoSync: API fetch failed", {message: e.message, stack: e.stack});
    return {ok: false, error: e.message};
  }

  const apiHash = computeApiHash(promos);
  logger.info("promoSync: API hash computed", {apiHashPrefix: apiHash.slice(0, 12)});

  const stateSnap = await stateRef.get();
  const lastApiHash = stateSnap.exists ? (stateSnap.get("lastApiHash") || null) : null;
  const lastMapperVersion = stateSnap.exists ?
    Number(stateSnap.get("mapperSyncVersion")) || 1 :
    1;
  const mapperVersionChanged = lastMapperVersion !== PROMO_MAPPER_SYNC_VERSION;
  logger.info("promoSync: SyncState loaded", {
    exists: stateSnap.exists,
    lastApiHashPrefix: lastApiHash ? lastApiHash.slice(0, 12) : null,
    lastMapperVersion,
    mapperSyncVersion: PROMO_MAPPER_SYNC_VERSION,
    mapperVersionChanged,
  });

  if (apiHash === lastApiHash && !mapperVersionChanged) {
    logger.info("promoSync: API and mapper unchanged; skipping Firestore sync");
    await stateRef.set({lastRunAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
    return {ok: true, unchanged: true};
  }

  if (mapperVersionChanged) {
    logger.info("promoSync: mapper version changed; forcing Firestore sync", {
      from: lastMapperVersion,
      to: PROMO_MAPPER_SYNC_VERSION,
    });
  }

  const result = await syncPromos(db, promos);
  logger.info("promoSync: sync done", {counts: result.counts});

  await stateRef.set(
      {
        lastApiHash: apiHash,
        mapperSyncVersion: PROMO_MAPPER_SYNC_VERSION,
        lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
  );
  logger.info("promoSync: run finished successfully");
  return {ok: true, ...result};
}

exports.syncPromoScheduled = onSchedule(
    {schedule: "every 2 minutes", region: "us-central1", timeoutSeconds: 120, memory: "512MiB", maxInstances: 1},
    async () => {
      logger.info("syncPromoScheduled: invocation started");
      try {
        const result = await run();
        logger.info("syncPromoScheduled: invocation finished", {result});
      } catch (err) {
        logger.error("syncPromoScheduled: invocation failed", err);
        throw err;
      }
    },
);

/* eslint-enable valid-jsdoc, max-len, require-jsdoc */
