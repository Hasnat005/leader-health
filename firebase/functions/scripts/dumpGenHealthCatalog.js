/* eslint-disable max-len, valid-jsdoc, require-jsdoc */
/**
 * One-off / local: fetch Gen Health categories + products via v2 API,
 * write JSON for debugging catalog / hash mismatches.
 *
 * Usage (from firebase/functions):
 *   node scripts/dumpGenHealthCatalog.js
 *   OUT_PATH=./gen-health-catalog-dump.json node scripts/dumpGenHealthCatalog.js
 *
 * Loads optional ../.env (GEN_HEALTH_API_KEY, GEN_HEALTH_PUBLIC_API_BASE_URL).
 */

const fs = require("fs");
const path = require("path");

try {
  require("dotenv").config({path: path.join(__dirname, "..", ".env")});
} catch (_) {
  /* dotenv is optional devDependency */
}

const {stableStringify, sha1Hex} = require("../utils/hash");
const {fetchCategories, fetchProducts} = require("../utils/genHealthApi");

const CATALOG_INGEST_VERSION = 2;

function sortCats(cats) {
  return [...cats].sort((a, b) =>
    String(a.categoryId || "").localeCompare(String(b.categoryId || "")));
}

function sortProds(prods) {
  return [...prods].sort((a, b) =>
    String(a.clientProductId || "").localeCompare(String(b.clientProductId || "")));
}

function computeApiHash(categories, products) {
  return sha1Hex(stableStringify({
    catalogIngestVersion: CATALOG_INGEST_VERSION,
    categories: sortCats(categories),
    products: sortProds(products),
  }));
}

async function main() {
  const outPath =
    process.env.OUT_PATH ||
    path.join(process.cwd(), "gen-health-catalog-dump.json");

  console.error("Fetching categories via v2 API…");
  const categories = await fetchCategories();
  console.error(`Categories: ${categories.length}. Fetching products (paginated)…`);
  const products = await fetchProducts();
  console.error(`Products: ${products.length}`);

  const apiHash = computeApiHash(categories, products);

  const out = {
    meta: {
      fetchedAt: new Date().toISOString(),
      catalogIngestVersion: CATALOG_INGEST_VERSION,
      apiHash,
      categoryCount: categories.length,
      productCount: products.length,
      notes: [
        "Uses v2 API: GET /v2/client/categories and GET /v2/client/products (paginated).",
        "If apiHash equals Firestore SyncState/catalog.lastApiHash, scheduled sync skips writes.",
      ],
    },
    categories,
    products,
  };

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.error(`Wrote ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MiB)`);
  console.error(`apiHash=${apiHash}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
