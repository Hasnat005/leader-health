/* eslint-disable max-len, valid-jsdoc, require-jsdoc, no-unused-vars */
/**
 * One-off / local: fetch dotFit catalog + inventory and dump JSON for debugging.
 * Does NOT touch Firestore.
 *
 * Usage (from firebase/functions):
 *   node scripts/dumpDotfitCatalog.js
 *   OUT_PATH=./dotfit-catalog-dump.json node scripts/dumpDotfitCatalog.js
 *
 * Loads optional ../.env (DOTFIT_* env vars). Falls back to dev/test creds
 * configured in ../config.js.
 */

const fs = require("fs");
const path = require("path");

try {
  require("dotenv").config({path: path.join(__dirname, "..", ".env")});
} catch (_) {
  /* optional */
}

const {dotfitApi} = require("../config");
const {getProducts, getInventory} = require("../utils/dotfitClient");

async function main() {
  const outPath =
    process.env.OUT_PATH ||
    path.join(process.cwd(), "dotfit-catalog-dump.json");

  console.error("dotFit endpoints:");
  console.error(`  inventoryServiceUrl=${dotfitApi.inventoryServiceUrl}`);
  console.error(`  ordersServiceUrl=${dotfitApi.ordersServiceUrl}`);
  console.error(`  clubGuid=${dotfitApi.clubGuid.slice(0, 8)}…`);
  console.error(`  wholesaleUserId=${dotfitApi.wholesaleUserId}`);
  console.error(`  stockThreshold=${dotfitApi.stockThreshold}`);

  console.error("\nFetching InventoryService.GetProducts …");
  const productsStarted = Date.now();
  const products = await getProducts();
  console.error(`  got ${products.length} products in ${Date.now() - productsStarted} ms`);

  console.error("\nFetching OrdersService.GetInventory …");
  const inventoryStarted = Date.now();
  const inventory = await getInventory();
  console.error(`  got ${inventory.length} stock rows in ${Date.now() - inventoryStarted} ms`);

  const categoryCount = new Set(products.map((p) => p.category)).size;
  const inStock = products.filter((p) => p.inventoryCount > dotfitApi.stockThreshold).length;

  const out = {
    meta: {
      fetchedAt: new Date().toISOString(),
      inventoryServiceUrl: dotfitApi.inventoryServiceUrl,
      ordersServiceUrl: dotfitApi.ordersServiceUrl,
      productCount: products.length,
      categoryCount,
      inStockCount: inStock,
      stockThreshold: dotfitApi.stockThreshold,
    },
    products,
    inventory,
  };

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.error(`\nWrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KiB)`);
  console.error(`Summary: ${products.length} products across ${categoryCount} categories, ${inStock} in stock (> ${dotfitApi.stockThreshold}).`);
}

main().catch((e) => {
  console.error("dump failed:", e);
  process.exit(1);
});
