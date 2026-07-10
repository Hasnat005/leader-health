import { addPropertyControls, ControlType } from "framer"
import { useEffect } from "react"
import {
  getLeaderHealthEndpoints,
  type LeaderHealthEnvironment,
} from "./LeaderHealthApiConfig"

const SESSION_KEY = "leader_health_funnel_sid_v1"

function getOrCreateSessionId(): string {
  if (typeof window === "undefined" || !crypto.randomUUID) return ""
  try {
    const match = document.cookie.match(/(?:^|;\s*)leader_health_funnel_sid_v1=([^;]+)/)
    if (match?.[1]) return decodeURIComponent(match[1])
  } catch {
    /* ignore */
  }
  const id = crypto.randomUUID()
  document.cookie = `${SESSION_KEY}=${encodeURIComponent(id)}; Max-Age=1800; Path=/; SameSite=Lax`
  return id
}

type Props = {
  environment: LeaderHealthEnvironment
  eventType: string
}

export default function FunnelPageTracker(props: Partial<Props>) {
  const { environment = "staging", eventType = "landing_view" } = props

  useEffect(() => {
    const sessionId = getOrCreateSessionId()
    if (!sessionId) return
    const { funnelHttp } = getLeaderHealthEndpoints(environment)
    const params = new URLSearchParams(window.location.search)
    fetch(`${funnelHttp}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        type: eventType,
        ts: Date.now(),
        path: window.location.pathname + window.location.search,
        payload: {},
        context: {
          utm: {
            source: params.get("utm_source") || "",
            medium: params.get("utm_medium") || "",
            campaign: params.get("utm_campaign") || "",
          },
        },
      }),
      keepalive: true,
    }).catch(() => {})
  }, [environment, eventType])

  return null
}

addPropertyControls(FunnelPageTracker, {
  environment: {
    type: ControlType.Enum,
    title: "Environment",
    options: ["staging", "production"],
    optionTitles: ["Staging", "Production"],
    defaultValue: "staging",
  },
  eventType: {
    type: ControlType.Enum,
    title: "Event",
    options: ["landing_view", "product_list_view", "product_view", "checkout_started"],
    optionTitles: ["Landing view", "Product list", "Product view", "Checkout started"],
    defaultValue: "landing_view",
  },
})
