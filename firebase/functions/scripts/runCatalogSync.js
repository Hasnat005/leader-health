/**
 * One-off catalog sync: Gen Health API → Firestore.
 * Usage: npm run catalog:sync (from functions/, with .env configured)
 */
require("dotenv").config();
const {runCatalogSync} = require("../scheduled/catalogSync");

runCatalogSync()
    .then((result) => {
      console.log("catalogSync complete:", JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error("catalogSync failed:", err);
      process.exit(1);
    });
