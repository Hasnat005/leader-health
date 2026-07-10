import { addPropertyControls, ControlType } from "framer"
import { useEffect, useState } from "react"
import {
  formatCents,
  getLeaderHealthEndpoints,
  isGenHealthProduct,
  type LeaderHealthEnvironment,
} from "./LeaderHealthApiConfig"

type Product = {
  clientProductId: string
  displayName: string
  name: string
  pricing?: { amount?: number; currency?: string }
  displayImageUrl?: string
  primaryCategory?: string
  featured?: boolean
}

type Props = {
  environment: LeaderHealthEnvironment
  categoryId: string
  maxItems: number
  columns: number
  showFeaturedOnly: boolean
  accentColor: string
  background: string
}

export default function GenHealthProductGrid(props: Partial<Props>) {
  const {
    environment = "staging",
    categoryId = "",
    maxItems = 12,
    columns = 3,
    showFeaturedOnly = false,
    accentColor = "#331110",
    background = "transparent",
  } = props

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const { catalogHttp } = getLeaderHealthEndpoints(environment)
    fetch(`${catalogHttp}/products`, { headers: { accept: "application/json" } })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((json) => {
        if (!json?.success) throw new Error("Invalid catalog response")
        let list = (json.data?.products ?? []).filter(isGenHealthProduct) as Product[]
        if (categoryId.trim()) {
          list = list.filter((p) =>
            (p as { matchedClientCategories?: string[] }).matchedClientCategories?.includes(
              categoryId.trim(),
            ),
          )
        }
        if (showFeaturedOnly) list = list.filter((p) => p.featured === true)
        setProducts(list.slice(0, Math.max(1, maxItems)))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [environment, categoryId, maxItems, showFeaturedOnly])

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
        Loading products…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 32, color: "#b91c1c" }}>
        Could not load products: {error}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
        No Gen Health products available.
      </div>
    )
  }

  return (
    <div
      style={{
        background,
        padding: 24,
        display: "grid",
        gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))`,
        gap: 20,
        width: "100%",
      }}
    >
      {products.map((p) => {
        const cents = p.pricing?.amount ?? 0
        const href = `/products?productId=${encodeURIComponent(p.clientProductId)}`
        return (
          <a
            key={p.clientProductId}
            href={href}
            style={{
              textDecoration: "none",
              color: "inherit",
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
              boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
            }}
          >
            {p.displayImageUrl && (
              <img
                src={p.displayImageUrl}
                alt=""
                style={{ width: "100%", height: 180, objectFit: "cover" }}
              />
            )}
            <div style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 8 }}>
                {p.displayName || p.name}
              </div>
              {cents > 0 && (
                <div style={{ color: accentColor, fontWeight: 600 }}>
                  {formatCents(cents, p.pricing?.currency)}/mo
                </div>
              )}
            </div>
          </a>
        )
      })}
    </div>
  )
}

addPropertyControls(GenHealthProductGrid, {
  environment: {
    type: ControlType.Enum,
    title: "Environment",
    options: ["staging", "production"],
    optionTitles: ["Staging", "Production"],
    defaultValue: "staging",
  },
  categoryId: { type: ControlType.String, title: "Category ID", defaultValue: "" },
  maxItems: { type: ControlType.Number, title: "Max Items", defaultValue: 12, min: 1, max: 48 },
  columns: { type: ControlType.Number, title: "Columns", defaultValue: 3, min: 1, max: 4 },
  showFeaturedOnly: { type: ControlType.Boolean, title: "Featured Only", defaultValue: false },
  accentColor: { type: ControlType.Color, title: "Accent", defaultValue: "#331110" },
  background: { type: ControlType.Color, title: "Background", defaultValue: "transparent" },
})
