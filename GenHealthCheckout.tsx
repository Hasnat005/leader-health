import { addPropertyControls, ControlType } from "framer"
import { useEffect, useMemo, useState } from "react"
import {
  getLeaderHealthEndpoints,
  getStorefrontHeaders,
  type LeaderHealthEnvironment,
} from "./LeaderHealthApiConfig"
import {
  clearGenHealthCart,
  useGenHealthCart,
} from "./GenHealthCartStore"

declare global {
  interface Window {
    Stripe?: (key: string) => {
      elements: () => {
        create: (type: string) => {
          mount: (el: HTMLElement) => void
        }
      }
      confirmCardPayment: (
        secret: string,
        data: { payment_method: { card: unknown } },
      ) => Promise<{ error?: { message?: string }; paymentIntent?: { id: string } }>
    }
  }
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
  "VA", "WA", "WV", "WI", "WY", "DC",
]

function loadStripeJs(): Promise<void> {
  if (window.Stripe) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://js.stripe.com/v3/"]')
    if (existing) {
      existing.addEventListener("load", () => resolve())
      return
    }
    const s = document.createElement("script")
    s.src = "https://js.stripe.com/v3/"
    s.onload = () => resolve()
    s.onerror = () => reject(new Error("Failed to load Stripe.js"))
    document.head.appendChild(s)
  })
}

type Props = {
  environment: LeaderHealthEnvironment
  storefrontApiKey: string
  stripePublishableKey: string
  accentColor: string
}

export default function GenHealthCheckout(props: Partial<Props>) {
  const {
    environment = "staging",
    storefrontApiKey = "",
    stripePublishableKey = "",
    accentColor = "#331110",
  } = props

  const cart = useGenHealthCart()
  const endpoints = useMemo(() => getLeaderHealthEndpoints(environment), [environment])

  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    dateOfBirth: "",
    street1: "",
    city: "",
    state: "TX",
    zip: "",
    promoCode: "",
  })
  const [cardReady, setCardReady] = useState(false)
  const [cardEl, setCardEl] = useState<ReturnType<
    ReturnType<NonNullable<typeof window.Stripe>>["elements"]
  >["create"]> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!stripePublishableKey.trim()) return
    let cardMount: HTMLElement | null = null
    loadStripeJs()
      .then(() => {
        const stripe = window.Stripe!(stripePublishableKey.trim())
        const elements = stripe.elements()
        const card = elements.create("card")
        setCardEl(() => card)
        cardMount = document.getElementById("lh-stripe-card")
        if (cardMount) {
          card.mount(cardMount)
          setCardReady(true)
        }
      })
      .catch((e) => setError(e.message))
    return () => {
      if (cardMount) cardMount.innerHTML = ""
    }
  }, [stripePublishableKey])

  const patient = useMemo(() => {
    const { email, firstName, lastName, phone, dateOfBirth, street1, city, state, zip } = form
    if (!email || !firstName || !lastName || !street1 || !city || !state || !zip) return null
    return {
      email: email.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      dateOfBirth: dateOfBirth.trim(),
      address: { street1: street1.trim(), city: city.trim(), state: state.trim(), zip: zip.trim() },
    }
  }, [form])

  async function handlePay() {
    setError(null)
    if (!storefrontApiKey.trim()) {
      setError("Storefront API key is required.")
      return
    }
    if (!patient) {
      setError("Please complete all required patient fields.")
      return
    }
    if (cart.items.length === 0) {
      setError("Your cart is empty.")
      return
    }
    if (!stripePublishableKey.trim() || !cardEl) {
      setError("Payment is not configured.")
      return
    }

    setLoading(true)
    try {
      const headers = getStorefrontHeaders(storefrontApiKey, {
        "Content-Type": "application/json",
      })
      const items = cart.items.map((item) => ({
        client_product_id: item.clientProductId,
        quantity: 1,
      }))

      const startRes = await fetch(`${endpoints.checkoutHttp}/start`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          items,
          patient,
          promo_code: form.promoCode.trim() || undefined,
          currency: "usd",
        }),
      })
      const startJson = await startRes.json()
      if (!startJson?.success) {
        throw new Error(startJson?.message || startJson?.error || "Could not start checkout")
      }

      const data = startJson.data || {}
      const sessionId = data.session_id as string | undefined
      const mode = data.mode as string | undefined
      const clientAction = data.client_action as {
        client_secret?: string
        payment_intent_id?: string
      } | undefined
      const clientSecret = clientAction?.client_secret
      const paymentIntentId = clientAction?.payment_intent_id

      if (!sessionId || !mode || !clientSecret || !paymentIntentId) {
        throw new Error("Missing checkout session from server")
      }

      const stripe = window.Stripe!(stripePublishableKey.trim())
      const { error: stripeErr, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardEl },
      })
      if (stripeErr) throw new Error(stripeErr.message || "Payment failed")
      if (!paymentIntent?.id) throw new Error("Missing payment intent")

      const completeRes = await fetch(`${endpoints.checkoutHttp}/complete`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          session_id: sessionId,
          mode,
          patient,
          payment_data: {
            type: "stripe_payment_intent",
            payment_intent_id: paymentIntent.id || paymentIntentId,
          },
        }),
      })
      const completeJson = await completeRes.json()
      if (!completeJson?.success) {
        throw new Error(completeJson?.message || completeJson?.error || "Order confirm failed")
      }

      clearGenHealthCart()
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <h2 style={{ color: accentColor }}>Order placed</h2>
        <p style={{ color: "#64748b" }}>Thank you. A clinician will review your intake shortly.</p>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 15,
    marginBottom: 12,
    boxSizing: "border-box",
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
      <h2 style={{ marginBottom: 20 }}>Checkout</h2>
      {cart.items.map((item) => (
        <div key={item.clientProductId} style={{ marginBottom: 8, color: "#334155" }}>
          {item.displayName || item.clientProductId}
        </div>
      ))}

      {(["email", "firstName", "lastName", "phone", "dateOfBirth", "street1", "city", "zip"] as const).map(
        (field) => (
          <input
            key={field}
            placeholder={field === "dateOfBirth" ? "Date of birth (YYYY-MM-DD)" : field}
            type={field === "email" ? "email" : "text"}
            value={form[field]}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            style={inputStyle}
          />
        ),
      )}

      <select
        value={form.state}
        onChange={(e) => setForm({ ...form, state: e.target.value })}
        style={inputStyle}
      >
        {US_STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <input
        placeholder="Promo code (optional)"
        value={form.promoCode}
        onChange={(e) => setForm({ ...form, promoCode: e.target.value })}
        style={inputStyle}
      />

      <div id="lh-stripe-card" style={{ padding: "12px 0", marginBottom: 16 }} />

      {error && <p style={{ color: "#b91c1c", marginBottom: 12 }}>{error}</p>}

      <button
        type="button"
        disabled={loading || !cardReady}
        onClick={() => void handlePay()}
        style={{
          width: "100%",
          padding: "14px 20px",
          borderRadius: 999,
          border: "none",
          background: accentColor,
          color: "#fff",
          fontWeight: 600,
          cursor: loading ? "wait" : "pointer",
          opacity: loading || !cardReady ? 0.7 : 1,
        }}
      >
        {loading ? "Processing…" : "Pay now"}
      </button>
    </div>
  )
}

addPropertyControls(GenHealthCheckout, {
  environment: {
    type: ControlType.Enum,
    title: "Environment",
    options: ["staging", "production"],
    optionTitles: ["Staging", "Production"],
    defaultValue: "staging",
  },
  storefrontApiKey: {
    type: ControlType.String,
    title: "Storefront API Key",
    defaultValue: "",
    obscured: true,
  },
  stripePublishableKey: {
    type: ControlType.String,
    title: "Stripe Publishable Key",
    defaultValue: "",
  },
  accentColor: { type: ControlType.Color, title: "Accent", defaultValue: "#331110" },
})
