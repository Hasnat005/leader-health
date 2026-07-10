# Framer Agent Prompt — Products Nav + Categorized Catalog

Copy everything below the line into **Framer → Agent** after you **GitHub Pull** the latest `leader-health` repo.

---

## Prompt (paste into Framer Agent)

```
Set up the Leader Health storefront products experience using Code Components from the GitHub-linked repo. Do NOT hardcode product names or prices — everything comes from the Afflynk catalogHttp API.

## Goal

1. Add a **Products** button to the site navbar that links to `/products`
2. Create (or update) the **`/products` page** with a full categorized product catalog directly under the navbar
3. Ensure products load live from Afflynk after Publish

## Code Components to use (from GitHub repo)

| Component | File | Purpose |
|-----------|------|---------|
| **ProductsNavLink** | `ProductsNavLink.tsx` | Navbar "Products" pill/link → `/products` |
| **GenHealthProductCatalog** | `GenHealthProductCatalog.tsx` | Full page: category pills + all products grouped by category + Add to cart |
| **FunnelPageTracker** | `FunnelPageTracker.tsx` | Track `product_list_view` on `/products` |
| **GenHealthCartSummary** | `GenHealthCartStore.tsx` | Optional cart summary widget |
| **GenHealthCheckout** | `GenHealthCheckout.tsx` | On `/checkout` page (separate task if missing) |

Shared config: `LeaderHealthApiConfig.ts` — Afflynk staging URLs (already wired).

## Step 1 — Navbar: Products button

1. Open the **site navbar** component/frame (desktop + mobile if separate).
2. Insert **ProductsNavLink** from Assets → Code next to existing nav links.
3. Property controls:
   - Label: `Products`
   - Link: `/products`
   - Accent: `#331110` (Leader Health maroon)
4. On mobile menu, add the same **ProductsNavLink** inside the hamburger/drawer nav.
5. Do NOT remove existing nav items — add Products alongside them.

## Step 2 — Create `/products` page

1. Add a new page: **Products** with path `/products`.
2. Page structure (top to bottom):
   - **Site navbar** (same component as homepage — must include ProductsNavLink)
   - **FunnelPageTracker** — Environment: `Staging`, Event: `product_list_view` (invisible, 0 height)
   - **GenHealthProductCatalog** — full width below navbar
3. **GenHealthProductCatalog** property controls:
   - Environment: `Staging`
   - Page Title: `Products`
   - Columns: `3` (desktop); use Framer breakpoints to set `2` on tablet, `1` on mobile if supported
   - Add to Cart: `true`
   - Accent: `#331110`
   - Background: `#f9f9f9`
   - Max Width: `1120`
4. The catalog component automatically:
   - Fetches `GET catalogHttp/categories` and `GET catalogHttp/products`
   - Shows sticky category pills (All + each category)
   - Groups products by category when "All" is selected
   - Filters grid when a category pill is clicked
   - Each card has **Add to cart** + **Checkout** link

## Step 3 — Visual polish (match Leader Health)

- Page background: `#f9f9f9`
- Navbar stays fixed/sticky at top (existing behavior)
- Category pill bar sticks below navbar (`top: 72px` is built into the component)
- Cards: white, 16px radius, subtle border `#e2e8f0`
- Typography: Geist / Inter, primary `#0f172a`, muted `#64748b`
- No Dotfit products (API filters them out)

## Step 4 — Optional homepage teaser

On the **homepage**, below the hero or in a "Treatments" section:
- Insert **GenHealthProductGrid** (simpler grid, max 6 items) OR link CTA to `/products`
- Environment: `Staging`
- Max Items: `6`
- Columns: `3`

## Step 5 — Checkout page (if not done)

- Page `/checkout` with **GenHealthCheckout**
- Environment: `Staging`
- Storefront API Key: (user fills in Afflynk `afl_live_...` key)
- Stripe Publishable Key: `pk_test_...`

## Step 6 — Publish & verify

1. **Preview** → open `/products` → products and categories should load
2. Click category pills → grid filters
3. Click **Add to cart** → cart persists (localStorage `leader-health-cart`)
4. **Publish** the site
5. Network tab: `catalogHttp/products` and `catalogHttp/categories` return 200

## Do NOT

- Modify afflynk backend code
- Hardcode product lists
- Use Dotfit or nxgenmd URLs
- Put Stripe secret keys or Afflynk secrets in code (checkout publishable key only)

## Done when

- [ ] Navbar shows **Products** link on desktop and mobile
- [ ] `/products` shows all Afflynk products with category pills
- [ ] Category filter works
- [ ] Add to cart works
- [ ] Published site matches preview
```

---

## After Agent finishes (manual steps)

1. **GitHub Pull** in Framer if Agent edited files locally in repo
2. Set **GenHealthCheckout** Storefront API Key on `/checkout` (not needed for catalog)
3. **Publish**

## Files added in this update

- `ProductsNavLink.tsx` — navbar Products button
- `GenHealthProductCatalog.tsx` — categorized full catalog page
- `FRAMER_PRODUCTS_PAGE_PROMPT.md` — this prompt
