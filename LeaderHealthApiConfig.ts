/**
 * Afflynk storefront API endpoints for Framer Code Components.
 * Backend: afflynk-staging Firebase (already deployed — do not modify afflynk repo).
 */

export type LeaderHealthEnvironment = "staging" | "production"

export type LeaderHealthEndpoints = {
  catalogHttp: string
  promoValidationHttp: string
  checkoutHttp: string
  funnelHttp: string
}

const AFFLYNK_BASE = "https://us-central1-afflynk-staging.cloudfunctions.net"

const STAGING: LeaderHealthEndpoints = {
  catalogHttp: `${AFFLYNK_BASE}/catalogHttp`,
  promoValidationHttp: `${AFFLYNK_BASE}/promoValidationHttp`,
  checkoutHttp: `${AFFLYNK_BASE}/checkoutHttp`,
  funnelHttp: `${AFFLYNK_BASE}/funnelHttp`,
}

const PRODUCTION: LeaderHealthEndpoints = {
  ...STAGING,
}

export function getLeaderHealthEndpoints(
  environment: LeaderHealthEnvironment = "staging",
): LeaderHealthEndpoints {
  return environment === "production" ? PRODUCTION : STAGING
}

/** Afflynk checkoutHttp requires X-Api-Key (storefront API key from Afflynk dashboard). */
export function getStorefrontHeaders(
  apiKey: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/json",
    ...extra,
  }
  const key = apiKey.trim()
  if (key) headers["X-Api-Key"] = key
  return headers
}

export function isGenHealthProduct(p: Record<string, unknown>): boolean {
  const provider = String(p.catalog_provider || "").toLowerCase()
  const source = String(p.source || "").toLowerCase()
  if (provider === "dotfit" || source === "dotfit") return false
  if (p.archived === true || p.storefrontEligible === false) return false
  const pricing = p.pricing as { amount?: number } | undefined
  const amount =
    typeof pricing?.amount === "number" ?
      pricing.amount :
      typeof p.unit_amount_cents === "number" ?
        p.unit_amount_cents :
        NaN
  return Number.isFinite(amount) && amount > 0
}

export function formatCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}
