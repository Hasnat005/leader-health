# Deploy Leader Health Firebase (staging)

Run these commands after creating Firebase projects `leader-health-staging` and `leader-health-prod`.

## 1. Login and select project

```powershell
cd F:\lab3\raff_vai\leader-health\firebase
firebase login
firebase use staging
```

## 2. Set secrets (interactive prompts)

```powershell
firebase functions:secrets:set GEN_HEALTH_API_KEY --project leader-health-staging
firebase functions:secrets:set STRIPE_SECRET_KEY --project leader-health-staging
```

Optional:

```powershell
firebase functions:secrets:set POSTMARK_SERVER_TOKEN --project leader-health-staging
```

## 3. Deploy

```powershell
npm install --prefix functions
npm run lint --prefix functions
firebase deploy --only firestore:rules,functions --project leader-health-staging
```

## 4. Seed catalog

```powershell
cd functions
copy .env.example .env
# Edit .env with GEN_HEALTH_API_KEY
npm run catalog:sync
```

## 5. Verify

```powershell
curl "https://us-central1-leader-health-staging.cloudfunctions.net/healthcheck"
curl "https://us-central1-leader-health-staging.cloudfunctions.net/catalogHttp/products"
```

## Production cutover

```powershell
firebase use production
# Set secrets on leader-health-prod (same as staging)
firebase deploy --only firestore:rules,functions --project leader-health-prod
```

In Framer, set Code Component **Environment** to `production`.
