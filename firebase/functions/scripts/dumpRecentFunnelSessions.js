/* eslint-disable valid-jsdoc, max-len, require-jsdoc */
/**
 * Dump recent FunnelSessions docs as JSON (timestamps → ISO strings).
 *
 * Usage (from firebase/functions):
 *   node scripts/dumpRecentFunnelSessions.js
 *   LIMIT=80 OUT_PATH=./my-dump.json node scripts/dumpRecentFunnelSessions.js
 */

const fs = require("fs");
const path = require("path");
const {db} = require("../utils/Firebase.js");

const FUNNEL_SESSIONS = "FunnelSessions";

/**
 * @param {FirebaseFirestore.DocumentSnapshot} doc
 * @returns {Record<string, unknown>}
 */
function serializeDoc(doc) {
  const d = doc.data() || {};
  /** @type {Record<string, unknown>} */
  const o = {id: doc.id};
  for (const [k, v] of Object.entries(d)) {
    if (v != null && typeof /** @type {{toDate?: () => Date}} */ (v).toDate === "function") {
      o[k] = /** @type {{toDate: () => Date}} */ (v).toDate().toISOString();
    } else if (v != null && typeof /** @type {{toMillis?: () => number}} */ (v).toMillis === "function") {
      o[k] = new Date(/** @type {{toMillis: () => number}} */ (v).toMillis()).toISOString();
    } else {
      o[k] = v;
    }
  }
  return o;
}

async function main() {
  const limit = Math.min(Math.max(parseInt(process.env.LIMIT || "50", 10) || 50, 1), 200);
  const snap = await db
      .collection(FUNNEL_SESSIONS)
      .orderBy("lastActivityAt", "desc")
      .limit(limit)
      .get();

  const rows = snap.docs.map(serializeDoc);
  const outPath =
    (process.env.OUT_PATH || "").trim() ||
    path.join(__dirname, "..", "funnel-sessions-recent-dump.json");
  fs.writeFileSync(outPath, JSON.stringify(rows, null, 2), "utf8");

  const emailMissing = rows.filter((r) => r.email == null || r.email === "");
  const entered = rows.filter((r) => r.enteredCheckoutAt != null);
  const abandoned = rows.filter((r) => r.abandoned === true);

  const summary = {
    written: outPath,
    count: rows.length,
    emailNullOrEmpty: emailMissing.length,
    withEnteredCheckoutAt: entered.length,
    abandonedTrue: abandoned.length,
    sampleIdsEmailMissing: emailMissing.slice(0, 8).map((r) => r.id),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/* eslint-enable valid-jsdoc, max-len, require-jsdoc */
