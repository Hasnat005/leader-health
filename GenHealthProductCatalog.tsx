import { addPropertyControls, ControlType } from "framer"
import { useEffect, useMemo, useState } from "react"
import {
  formatCents,
  getLeaderHealthEndpoints,
  isGenHealthProduct,
  type LeaderHealthEnvironment,
} from "./LeaderHealthApiConfig"
import { addGenHealthToCart } from "./GenHealthCartStore"

type Category = {
  categoryId: string
  categoryName: string
}

type Product = {
  clientProductId: string
  displayName: string
  name: string
  pricing?: { amount?: number; currency?: string }
  displayImageUrl?: string
  primaryCategory?: string
  matchedClientCategories?: string[]
  featured?: boolean
}

type Props = {
  environment: LeaderHealthEnvironment
  pageTitle: string
  columns: number
  showAddToCart: boolean
  accentColor: string
  background: string
  maxWidth: number
}

function categoryLabel(cat: Category): string {
  return cat.categoryName?.trim() || cat.categoryId
}

function productCategories(product: Product, categoryMap: Map<string, string>): string[] {
  const ids = product.matchedClientCategories?.length ?
    product.matchedClientCategories :
    product.primaryCategory ?
      [product.primaryCategory] :
      []
  return ids.map((id) => categoryMap.get(id) || id).filter(Boolean)
}

export default function GenHealthProductCatalog(props: Partial<Props>) {
  const {
    environment = "staging",
    pageTitle = "Products",
    columns = 3,
    showAddToCart = true,
    accentColor = "#331110",
    background = "#f9f9f9",
    maxWidth = 1120,
  } = props

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addedId, setAddedId] = useState<string | null>(null)

  useEffect(() => {
    const { catalogHttp } = getLeaderHealthEndpoints(environment)
    Promise.all([
      fetch(`${catalogHttp}/categories`, { headers: { accept: "application/json" } }).then((r) =>
        r.ok ? r.json() : { success: false, data: { categories: [] } },
      ),
      fetch(`${catalogHttp}/products`, { headers: { accept: "application/json" } }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
    ])
      .then(([catJson, prodJson]) => {
        if (!prodJson?.success) throw new Error("Invalid catalog response")
        const cats = (catJson?.data?.categories ?? []) as Category[]
        const list = (prodJson.data?.products ?? []).filter(isGenHealthProduct) as Product[]
        setCategories(cats)
        setProducts(list)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load catalog"))
      .finally(() => setLoading(false))
  }, [environment])

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach((c) => map.set(c.categoryId, categoryLabel(c)))
    return map
  }, [categories])

  const visibleCategories = useMemo(() => {
    const withProducts = new Set<string>()
    products.forEach((p) => {
      p.matchedClientCategories?.forEach((id) => withProducts.add(id))
      if (p.primaryCategory) withProducts.add(p.primaryCategory)
    })
    return categories.filter((c) => withProducts.has(c.categoryId))
  }, [categories, products])

  const filteredProducts = useMemo(() => {
    if (selectedCategoryId === "all") return products
    return products.filter((p) =>
      p.matchedClientCategories?.includes(selectedCategoryId) ||
      p.primaryCategory === selectedCategoryId,
    )
  }, [products, selectedCategoryId])

  const groupedSections = useMemo(() => {
    if (selectedCategoryId !== "all") {
      const cat = categories.find((c) => c.categoryId === selectedCategoryId)
      return [{
        categoryId: selectedCategoryId,
        title: cat ? categoryLabel(cat) : selectedCategoryId,
        items: filteredProducts,
      }]
    }

    const sections: { categoryId: string; title: string; items: Product[] }[] = []
    const used = new Set<string>()

    visibleCategories.forEach((cat) => {
      const items = products.filter((p) =>
        p.matchedClientCategories?.includes(cat.categoryId) ||
        p.primaryCategory === cat.categoryId,
      )
      if (items.length) {
        sections.push({ categoryId: cat.categoryId, title: categoryLabel(cat), items })
        items.forEach((p) => used.add(p.clientProductId))
      }
    })

    const uncategorized = products.filter((p) => !used.has(p.clientProductId))
    if (uncategorized.length) {
      sections.push({ categoryId: "other", title: "More products", items: uncategorized })
    }

    return sections.length ? sections : [{ categoryId: "all", title: "All products", items: products }]
  }, [selectedCategoryId, filteredProducts, visibleCategories, categories, products])

  function handleAddToCart(product: Product) {
    const cents = product.pricing?.amount ?? 0
    addGenHealthToCart({
      clientProductId: product.clientProductId,
      displayName: product.displayName || product.name,
      amountCents: cents,
      imageUrl: product.displayImageUrl,
    })
    setAddedId(product.clientProductId)
    window.setTimeout(() => setAddedId(null), 1800)
  }

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px",
    borderRadius: 999,
    border: active ? `1px solid ${accentColor}` : "1px solid #e2e8f0",
    background: active ? accentColor : "#fff",
    color: active ? "#fff" : "#334155",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
  })

  const cardGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))`,
    gap: 20,
    width: "100%",
  }

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#64748b", background }}>
        Loading products…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 48, color: "#b91c1c", background }}>
        Could not load products: {error}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#64748b", background }}>
        No products available.
      </div>
    )
  }

  return (
    <div style={{ background, width: "100%", minHeight: "60vh" }}>
      <div style={{ maxWidth, margin: "0 auto", padding: "32px 24px 48px" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 700, color: "#0f172a" }}>
          {pageTitle}
        </h1>
        <p style={{ margin: "0 0 24px", color: "#64748b", fontSize: 16 }}>
          {products.length} treatment{products.length === 1 ? "" : "s"} available
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 32,
            position: "sticky",
            top: 72,
            zIndex: 10,
            background,
            padding: "12px 0",
          }}
        >
          <button type="button" style={pillStyle(selectedCategoryId === "all")} onClick={() => setSelectedCategoryId("all")}>
            All
          </button>
          {visibleCategories.map((cat) => (
            <button
              key={cat.categoryId}
              type="button"
              style={pillStyle(selectedCategoryId === cat.categoryId)}
              onClick={() => setSelectedCategoryId(cat.categoryId)}
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </div>

        {groupedSections.map((section) => (
          <section key={section.categoryId} style={{ marginBottom: 40 }}>
            {selectedCategoryId === "all" && (
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: 22,
                  fontWeight: 600,
                  color: "#0f172a",
                  borderBottom: "1px solid #e2e8f0",
                  paddingBottom: 10,
                }}
              >
                {section.title}
              </h2>
            )}
            <div style={cardGridStyle}>
              {section.items.map((p) => {
                const cents = p.pricing?.amount ?? 0
                const labels = productCategories(p, categoryMap)
                return (
                  <article
                    key={p.clientProductId}
                    style={{
                      background: "#fff",
                      borderRadius: 16,
                      border: "1px solid #e2e8f0",
                      overflow: "hidden",
                      boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {p.displayImageUrl && (
                      <img
                        src={p.displayImageUrl}
                        alt=""
                        style={{ width: "100%", height: 180, objectFit: "cover" }}
                      />
                    )}
                    <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
                      {labels.length > 0 && (
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                          {labels.join(" · ")}
                        </div>
                      )}
                      <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 8, color: "#0f172a" }}>
                        {p.displayName || p.name}
                      </div>
                      {cents > 0 && (
                        <div style={{ color: accentColor, fontWeight: 600, marginBottom: 12 }}>
                          {formatCents(cents, p.pricing?.currency)}
                        </div>
                      )}
                      <div style={{ marginTop: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {showAddToCart && (
                          <button
                            type="button"
                            onClick={() => handleAddToCart(p)}
                            style={{
                              flex: 1,
                              minWidth: 120,
                              padding: "10px 16px",
                              borderRadius: 999,
                              border: "none",
                              background: accentColor,
                              color: "#fff",
                              fontWeight: 600,
                              cursor: "pointer",
                              fontSize: 14,
                            }}
                          >
                            {addedId === p.clientProductId ? "Added ✓" : "Add to cart"}
                          </button>
                        )}
                        <a
                          href={`/checkout`}
                          style={{
                            padding: "10px 16px",
                            borderRadius: 999,
                            border: `1px solid ${accentColor}`,
                            color: accentColor,
                            textDecoration: "none",
                            fontWeight: 600,
                            fontSize: 14,
                            textAlign: "center",
                          }}
                        >
                          Checkout
                        </a>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

addPropertyControls(GenHealthProductCatalog, {
  environment: {
    type: ControlType.Enum,
    title: "Environment",
    options: ["staging", "production"],
    optionTitles: ["Staging", "Production"],
    defaultValue: "staging",
  },
  pageTitle: { type: ControlType.String, title: "Page Title", defaultValue: "Products" },
  columns: { type: ControlType.Number, title: "Columns", defaultValue: 3, min: 1, max: 4 },
  showAddToCart: { type: ControlType.Boolean, title: "Add to Cart", defaultValue: true },
  accentColor: { type: ControlType.Color, title: "Accent", defaultValue: "#331110" },
  background: { type: ControlType.Color, title: "Background", defaultValue: "#f9f9f9" },
  maxWidth: { type: ControlType.Number, title: "Max Width", defaultValue: 1120, min: 800, max: 1400 },
})
