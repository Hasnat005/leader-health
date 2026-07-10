# Leader Health

Framer storefront code + Firebase backend for [Leader Health](https://www.myleaderhealth.com/).

## Structure

| Path | Purpose |
|------|---------|
| `*.tsx` | Framer Code Components (sync via GitHub Link) |
| `firebase/` | Cloud Functions, Firestore rules, deploy config |
| `FRAMER_AGENT_BRIEF.md` | Full spec for Framer Agent |

## Quick start

### Backend

1. Create Firebase projects `leader-health-staging` and `leader-health-prod` in [Firebase Console](https://console.firebase.google.com/)
2. Follow [firebase/DEPLOY.md](firebase/DEPLOY.md)

### Framer

1. Pull `.tsx` files from GitHub in Framer GitHub Link
2. Add components: `GenHealthProductGrid`, `GenHealthCheckout`, `FunnelPageTracker`
3. Set **Environment** = `staging` and **Stripe Publishable Key** on checkout
4. Publish

## API components

- `LeaderHealthApiConfig.ts` — endpoint URLs (staging/production)
- `GenHealthProductGrid.tsx` — product catalog from `catalogHttp`
- `GenHealthCartStore.tsx` — cart + `GenHealthCartSummary`
- `GenHealthAddToCartButton.tsx` — add to cart
- `GenHealthCheckout.tsx` — patient form + Stripe + `checkoutHttp`
- `FunnelPageTracker.tsx` — `funnelHttp` page events

Gen Health products only. No Dotfit.
