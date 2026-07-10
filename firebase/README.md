# Leader Health Firebase

Standalone backend for the [Leader Health](https://www.myleaderhealth.com/) Framer storefront.

## Stack

- **Firestore** — cached Gen Health catalog, checkout sessions, funnel analytics
- **Cloud Functions** — `catalogHttp`, `promoValidationHttp`, `funnelHttp`, `checkoutHttp`
- **Gen Health API** — source of truth for products and consults
- **Stripe** — payments

Gen Health products only. No Dotfit, no affiliate dashboard.

## Projects

| Alias | Firebase project ID |
|-------|---------------------|
| staging (default) | `leader-health-staging` |
| production | `leader-health-prod` |

Create both in [Firebase Console](https://console.firebase.google.com/) with **Blaze** billing and Firestore in **nam5**.

## First-time setup

```bash
cd leader-health/firebase
npm install --prefix functions
firebase login
firebase use staging   # or: firebase use leader-health-staging
```

Set secrets (repeat for production with `firebase use production`):

```bash
firebase functions:secrets:set GEN_HEALTH_API_KEY
firebase functions:secrets:set STRIPE_SECRET_KEY
# optional:
firebase functions:secrets:set POSTMARK_SERVER_TOKEN
```

Local emulator:

```bash
cp functions/.env.example functions/.env
# edit functions/.env with your keys
npm run serve --prefix functions
```

## Deploy

```bash
cd leader-health/firebase
firebase deploy --only firestore:rules,functions --project leader-health-staging
```

## Seed catalog

After deploy, run a one-time catalog sync (requires `.env` with `GEN_HEALTH_API_KEY`):

```bash
cd leader-health/firebase/functions
npm run catalog:sync
```

Verify:

```bash
curl "https://us-central1-leader-health-staging.cloudfunctions.net/catalogHttp/products"
```

## HTTP endpoints (after deploy)

Replace `leader-health-staging` with your project ID:

| Function | URL |
|----------|-----|
| catalogHttp | `https://us-central1-leader-health-staging.cloudfunctions.net/catalogHttp` |
| promoValidationHttp | `https://us-central1-leader-health-staging.cloudfunctions.net/promoValidationHttp` |
| funnelHttp | `https://us-central1-leader-health-staging.cloudfunctions.net/funnelHttp` |
| checkoutHttp | `https://us-central1-leader-health-staging.cloudfunctions.net/checkoutHttp` |
| healthcheck | `https://us-central1-leader-health-staging.cloudfunctions.net/healthcheck` |

Routes:

- `GET {catalogHttp}/categories`
- `GET {catalogHttp}/products`
- `GET {catalogHttp}/products?clientProductId=...`
- `POST {promoValidationHttp}` — body: `{ promoCode, products: [...] }`
- `POST {funnelHttp}/event`
- `POST {funnelHttp}/link`
- `POST {checkoutHttp}/create-payment-intent`
- `POST {checkoutHttp}/confirm`

## Framer integration

Framer Code Components in the repo root call these URLs via `LeaderHealthApiConfig.tsx`. Never put secret keys in Framer — only Stripe **publishable** key as a property control.

Workflow: edit `.tsx` → push GitHub → Pull in Framer → Publish.

## Scheduled jobs

- `syncCatalogScheduled` — every 15 minutes (Gen Health → Firestore)
- `syncPromoScheduled` — promo mirror from Gen Health
