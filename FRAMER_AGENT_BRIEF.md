# Framer Agent Brief — Leader Health Landing + Gen Health Checkout

Use this document as the **single source of truth** for implementing the Leader Health Framer site with a **full Gen Health product catalog and Stripe checkout**. Reference implementation lives in the **`nxgenmd`** monorepo (`landing/` + `firebase/functions/`).

---

## Goal

Build a complete storefront flow inside **Leader Health Prototype (copy)**:

1. **Browse** Gen Health products (from API — not hardcoded)
2. **Product detail** with pricing from server
3. **Cart** (Gen Health only)
4. **Checkout** with patient form, promo code, Stripe payment, order confirm
5. **Funnel analytics** on key pages

**Critical constraint:** Include **Gen Health products only**. **Do NOT** integrate Dotfit supplements, `dotfitCatalogHttp`, mixed carts, or Dotfit shipping flows.

---

## Design system (match existing Leader Health Framer site)

- **Background:** `#f9f9f9`
- **Card background:** `#ffffff`
- **Primary text:** `#0f172a`
- **Muted text:** `#64748b`
- **Brand accent / links:** `#331110` (maroon)
- **Borders:** `#e2e8f0`
- **Fonts:** Geist, Inter (fallback system-ui)
- **Border radius:** 12–16px cards, pill buttons for CTAs
- **Layout:** Full-width sections, max content width ~1120px centered
- Match the visual quality of existing homepage sections (hero, 3-step care flow, product cards)

Reuse existing code where possible:
- `AddToCartButton/CartStore.tsx` — **upgrade** (see Cart section)
- `PurchaseSelector.tsx` — optional for subscribe vs one-time UI
- `DevWorkflowSection.tsx` — keep at bottom of homepage (developer docs)

---

## API environment

**Use Afflynk** (`afflynk-staging`) — already deployed. Do **not** modify the afflynk repo; only update Framer Code Components here.

Set `environment` on components: `staging` | `production`.

Endpoints are in [`LeaderHealthApiConfig.ts`](LeaderHealthApiConfig.ts).

### Staging (default)

| Service | Base URL |
|---------|----------|
| **catalogHttp** | `https://us-central1-afflynk-staging.cloudfunctions.net/catalogHttp` |
| **promoValidationHttp** | `https://us-central1-afflynk-staging.cloudfunctions.net/promoValidationHttp` |
| **checkoutHttp** | `https://us-central1-afflynk-staging.cloudfunctions.net/checkoutHttp` |
| **funnelHttp** | `https://us-central1-afflynk-staging.cloudfunctions.net/funnelHttp` |

**checkoutHttp** (Afflynk storefront): `POST /start` → Stripe confirm → `POST /complete`. Requires **`X-Api-Key`** header (set **Storefront API Key** on `GenHealthCheckout`).

**catalogHttp** / **funnelHttp**: public read/ingest — `GET /products`, `POST /event` (no API key on those components).

### Production

Same Afflynk staging project until a production cutover.

### Never use

- `dotfitCatalogHttp` (any URL)
- Any product where `catalog_provider === 'dotfit'` or `source === 'dotfit'`

---

## Security rules

- All Framer code runs in the **browser** — **never** embed API keys, Stripe secret keys, or Gen Health private keys.
- Only call **public HTTP endpoints** listed above (they have CORS enabled).
- Stripe: use **publishable key only** via Framer property control (`pk_test_...` or `pk_live_...`).
- Payment confirmation uses `clientSecret` returned from `checkoutHttp`.

---

## Gen Health product filtering

When fetching from `catalogHttp`, **filter client-side** before display:

```typescript
function isGenHealthProduct(p: Record<string, unknown>): boolean {
  const provider = String(p.catalog_provider || "").toLowerCase()
  const source = String(p.source || "").toLowerCase()
  if (provider === "dotfit" || source === "dotfit") return false
  // Include gen_health and legacy products without provider (catalogHttp Products collection)
  return provider === "gen_health" || provider === "" || provider === "genhealth"
}
```

Also skip products where:
- `archived === true`
- `storefrontEligible === false`
- `pricing.amount` is missing or ≤ 0 (amount is **integer cents**)

---

## API reference

### 1. Categories

```
GET {catalogHttp}/categories
Accept: application/json
```

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      { "categoryId": "weight-loss", "categoryName": "Weight Loss" }
    ]
  }
}
```

### 2. Products list

```
GET {catalogHttp}/products
Accept: application/json
```

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "clientProductId": "semaglutide-1",
        "productId": "...",
        "name": "Semaglutide",
        "displayName": "Compounded Semaglutide",
        "description": "...",
        "categories": [],
        "matchedClientCategories": ["weight-loss"],
        "primaryCategory": "weight-loss",
        "pricing": { "amount": 24700, "currency": "usd" },
        "displayImageUrl": "https://...",
        "imageUrl": "https://...",
        "featured": true,
        "catalog_provider": "gen_health",
        "landingContent": { "tagline": "...", "benefits": [] }
      }
    ]
  }
}
```

**Price display:** `pricing.amount / 100` → USD (e.g. 24700 → $247.00)

### 3. Product detail

```
GET {catalogHttp}/products?clientProductId={id}
Accept: application/json
```

**Response:**
```json
{
  "success": true,
  "data": {
    "product": { /* same shape as list item */ },
    "landingContent": { /* extended marketing content */ },
    "content": {
      "services": [],
      "faq": []
    }
  }
}
```

### 4. Promo validation

```
POST {promoValidationHttp}
Content-Type: application/json
```

**Body:**
```json
{
  "promoCode": "SAVE10",
  "products": [{ "clientProductId": "semaglutide-1", "quantity": 1 }],
  "catalog_provider": "gen_health"
}
```

**Response (success):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "applicable": true,
    "freeShipping": false,
    "pricing": {
      "originalCents": 24700,
      "finalCents": 22230,
      "discountCents": 2470
    }
  }
}
```

### 5. Create payment intent

```
POST {checkoutHttp}/create-payment-intent
Content-Type: application/json
```

**Body (Gen Health only — no shipping object needed for GH-only carts):**
```json
{
  "items": [
    {
      "catalog_provider": "gen_health",
      "clientProductId": "semaglutide-1",
      "quantity": 1
    }
  ],
  "patient": {
    "email": "patient@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "phone": "5555555555",
    "dateOfBirth": "1990-01-15",
    "address": {
      "street1": "123 Main St",
      "city": "Houston",
      "state": "TX",
      "zip": "77001"
    }
  },
  "promoCode": "SAVE10",
  "currency": "usd",
  "funnelSessionId": "uuid-v4"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "checkout-session-doc-id",
    "clientSecret": "pi_xxx_secret_xxx",
    "totalCents": 22230,
    "subtotalCents": 24700,
    "lineItems": []
  }
}
```

For **price quote only** (before payment), add `"quoteOnly": true` — do not use for final payment step.

### 6. Confirm checkout

After Stripe `confirmCardPayment(clientSecret)` succeeds:

```
POST {checkoutHttp}/confirm
Content-Type: application/json
```

**Body:**
```json
{
  "sessionId": "checkout-session-doc-id",
  "paymentIntentId": "pi_xxx",
  "patient": { /* same patient object */ },
  "promoCodeEntered": "SAVE10",
  "funnelSessionId": "uuid-v4"
}
```

### 7. Funnel events

```
POST {funnelHttp}/event
Content-Type: application/json
```

**Body:**
```json
{
  "sessionId": "uuid-v4",
  "type": "landing_view",
  "ts": 1710000000000,
  "path": "/",
  "payload": {},
  "context": {
    "utm": { "source": "", "medium": "", "campaign": "" }
  }
}
```

**Allowed event types:** `landing_view`, `product_list_view`, `product_view`, `checkout_started`, `checkout_step_completed`, `order_button_clicked`, `order_placed`

**Link checkout session (optional):**
```
POST {funnelHttp}/link
{ "sessionId": "...", "checkoutSessionId": "...", "email": "..." }
```

**Funnel session cookie:** `leader_health_funnel_sid_v1` (UUID v4, 30 min rolling, SameSite=Lax)

---

## Code components to create

Create these as **Framer Code Components** in `Assets → Code`. Use TypeScript React with `addPropertyControls`.

### A. `NxgenApiConfig.ts` (shared constants)

Export helper:

```typescript
export function getApiEndpoints(environment: "staging" | "production") {
  // return { catalogHttp, promoValidationHttp, checkoutHttp, funnelHttp }
}
```

Used by all other components.

---

### B. `GenHealthProductGrid.tsx`

**Purpose:** Product listing for `/products` and homepage “More by design” section.

**Behavior:**
- Fetch `GET {catalogHttp}/products` on mount
- Filter to Gen Health products only (see filtering rules)
- Optional prop: `categoryId` to filter by `matchedClientCategories`
- Display: image, `displayName`, price `/mo` if subscription-style
- Loading skeleton + error state
- Click product → navigate to `/products?productId={clientProductId}` or open product detail overlay
- Track `product_list_view` funnel event

**Property controls:** `environment`, `categoryId`, `columns`, `maxItems`, `showFeaturedOnly`

---

### C. `GenHealthProductDetail.tsx`

**Purpose:** Product detail section on `/products` page.

**Behavior:**
- Read `productId` from URL query (`?productId=` or `?clientProductId=`)
- Fetch `GET {catalogHttp}/products?clientProductId=...`
- Show: name, description, price, benefits from `landingContent`, FAQ from `content.faq`
- **Add to Cart** button
- Track `product_view` funnel event

---

### D. `GenHealthCartStore.tsx` (replace/upgrade existing cart)

**Purpose:** Shared cart state for Gen Health items only.

**Storage key:** `leader-health-cart` (localStorage)

**Item shape:**
```typescript
type CartItem = {
  catalog_provider: "gen_health"
  clientProductId: string
  quantity: 1  // GH items always qty 1
  displayName?: string
  amountCents?: number
  imageUrl?: string
}
```

**Exports:**
- `useGenHealthCart()` hook
- `addGenHealthToCart(item)`
- `removeFromCart(clientProductId)`
- `clearCart()`
- `toCheckoutApiItems()` → `[{ catalog_provider: "gen_health", clientProductId, quantity: 1 }]`

**Upgrade** existing `AddToCartButton/CartStore.tsx` to call this store instead of generic localStorage.

---

### E. `GenHealthCartDrawer.tsx` (optional but recommended)

**Purpose:** Slide-over cart with line items, subtotal, “Checkout” CTA.

**Behavior:**
- Subtotal from stored `amountCents` or re-fetch catalog for fresh prices
- Checkout button → navigate to `/checkout` Framer page (or `?checkout=1` on products page)
- Track `checkout_started` when opening checkout

---

### F. `GenHealthCheckout.tsx` (full checkout page)

**Purpose:** Complete checkout on a new Framer page `/checkout` (create page if missing).

**Sections (accordion or steps — match nxgenmd Checkout.jsx logic, Gen Health only):**

1. **Patient details**
   - email, firstName, lastName, phone, dateOfBirth (YYYY-MM-DD)
   - address: street1, city, state (US dropdown), zip
   - Validate before proceeding

2. **Medical screening** (required checkboxes — copy from nxgenmd):
   - Active cancer or history of cancer
   - Diabetic retinopathy
   - Intracranial hypertension
   - Known allergy to growth hormone releasing peptides
   - Active proliferative diabetic retinopathy
   - Prader-Willi syndrome with obesity
   - Acute critical illness
   - Closed epiphyses in children

3. **Promo code** (optional)
   - Call promo validation API
   - Show discount in price breakdown

4. **Payment**
   - Load Stripe.js via `@stripe/stripe-js` (use dynamic import or script tag)
   - Call `create-payment-intent` with cart items + patient + promo
   - Render Stripe Card Element with returned `clientSecret`
   - On pay: `stripe.confirmCardPayment(clientSecret)`
   - On success: call `confirm` endpoint
   - Show success state + order confirmation message
   - Clear cart
   - Track `order_placed`

**Property controls:**
- `environment` (staging/production)
- `stripePublishableKey` (required)
- `supportEmail` (default: `help@myleaderhealth.com`)

**Do NOT implement:** Dotfit shipping method selection, `needsShippingSelection` flows, mixed cart logic.

**Patient builder (required fields for API):**
```typescript
function patientFromForm(form) {
  // email, firstName, lastName, street1, city, state, zip required
  // phone, dateOfBirth optional but recommended
  return { email, firstName, lastName, phone, dateOfBirth, address: { street1, city, state, zip } }
}
```

---

### G. `FunnelTracker.tsx` or Custom Code snippet

**Purpose:** Track page views site-wide.

Add to **Site Settings → Custom Code → End of body** OR mount once on Home:

- Create/read funnel session cookie
- On route change / page load: POST `landing_view` or `product_view` etc.
- Parse UTM params from URL into `context.utm`

---

### H. Update `AddToCartButton`

Wire existing button component to `GenHealthCartStore`:
- Props: `clientProductId`, `displayName`, `priceCents`, `imageUrl`
- On click: add to cart + optional toast “Added to cart”

---

## Framer pages to wire

| Page | Components / actions |
|------|----------------------|
| **Home** | `GenHealthProductGrid` (featured, max 3–6 items), funnel tracking, keep `DevWorkflowSection` at bottom |
| **/products** | `GenHealthProductGrid` (full), `GenHealthProductDetail` when `?productId=` present |
| **/labs** | `GenHealthProductGrid` filtered to lab/diagnostic category if applicable |
| **/pricing-plans** (draft → publish) | `GenHealthProductGrid` or static + API prices |
| **/checkout** (create new page) | `GenHealthCheckout` full width |
| **/survey** | Keep existing `Survey.tsx` (Wizlo) — do not replace with nxgenmd |

**Navigation:** Update nav “Get Started” / product CTAs to link to `/products` or `/checkout`.

---

## Checkout URL patterns

Support deep links (for marketing CTAs):

```
/checkout?productId=semaglutide-1
/products?productId=semaglutide-1
```

Parse query params in components (Framer supports URL search params in Code Components via `window.location.search`).

---

## Stripe integration in Framer

Framer Code Components can use Stripe.js:

```typescript
// Property control: stripePublishableKey
import { loadStripe } from "@stripe/stripe-js"

const stripe = await loadStripe(stripePublishableKey)
const elements = stripe.elements()
const card = elements.create("card")
// mount card to div ref

// After create-payment-intent returns clientSecret:
const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: { card, billing_details: { name, email } }
})
```

Use `paymentIntent.id` as `paymentIntentId` in confirm call.

---

## Error handling UX

- Network errors: friendly message + retry button
- Empty catalog: “No products available”
- Invalid promo: inline error under promo field
- Payment failed: show Stripe error message
- Loading states on all async actions

---

## Testing checklist

After implementation, verify on Framer **Preview** then **Publish**:

- [ ] Products load from staging `catalogHttp` (Network tab → 200)
- [ ] No Dotfit products appear
- [ ] Add to cart persists in localStorage
- [ ] Checkout creates payment intent (200, returns `clientSecret`)
- [ ] Stripe test card `4242 4242 4242 4242` completes payment
- [ ] Confirm endpoint returns success
- [ ] Funnel events appear in Network tab (`funnelHttp/event`)
- [ ] Mobile responsive layout
- [ ] Matches Leader Health visual style

---

## Implementation order (for Agent)

1. `NxgenApiConfig.ts` + `FunnelTracker` snippet
2. `GenHealthCartStore.tsx` + update `AddToCartButton`
3. `GenHealthProductGrid.tsx` → place on Home + `/products`
4. `GenHealthProductDetail.tsx`
5. Create `/checkout` page + `GenHealthCheckout.tsx`
6. Wire nav CTAs
7. Polish loading/error states + publish

---

## Reference files in nxgenmd repo (read-only — do not copy Dotfit parts)

| File | What to learn |
|------|----------------|
| `landing/src/lib/config.js` | API base URLs |
| `landing/src/lib/apiClient.js` | Catalog fetch patterns |
| `landing/src/lib/checkoutApi.js` | Payment intent + confirm payloads |
| `landing/src/lib/promoValidationApi.js` | Promo POST body |
| `landing/src/lib/cartStorage.js` | Cart item shape (Gen Health lines only) |
| `landing/src/lib/funnelTracker.js` | Funnel event queue |
| `landing/src/pages/Checkout.jsx` | Checkout UX (ignore Dotfit sections) |
| `firebase/functions/endpoints/catalog.js` | Product API shape |
| `firebase/functions/lib/catalogProvider.js` | gen_health vs dotfit |

---

## Agent instructions summary

> Build Leader Health storefront in Framer using **nxgenmd staging APIs**. Gen Health products only — **exclude all Dotfit**. Create Code Components for product grid, product detail, cart store, and full Stripe checkout. Match existing Leader Health design (#f9f9f9, #331110 accent, Geist/Inter). Wire Home, /products, and new /checkout page. Add funnel tracking. Never put secrets in code — Stripe publishable key via property control only. Pull existing components from GitHub repo `Hasnat005/leader-health` and extend them. Publish when complete.
