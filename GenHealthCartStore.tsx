import { addPropertyControls, ControlType } from "framer"
import { useSyncExternalStore } from "react"

const CART_KEY = "leader-health-cart"

export type GenHealthCartItem = {
  catalog_provider: "gen_health"
  clientProductId: string
  quantity: 1
  displayName?: string
  amountCents?: number
  imageUrl?: string
}

type StoredCart = { items: GenHealthCartItem[] }

const listeners = new Set<() => void>()

function readCart(): StoredCart {
  if (typeof localStorage === "undefined") return { items: [] }
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return { items: [] }
    const parsed = JSON.parse(raw)
    if (!parsed?.items || !Array.isArray(parsed.items)) return { items: [] }
    return {
      items: parsed.items.filter(
        (i: GenHealthCartItem) =>
          i?.catalog_provider === "gen_health" && i.clientProductId,
      ),
    }
  } catch {
    return { items: [] }
  }
}

function writeCart(cart: StoredCart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
  listeners.forEach((l) => l())
}

export function useGenHealthCart() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    readCart,
    () => ({ items: [] }),
  )
}

export function addGenHealthToCart(item: Omit<GenHealthCartItem, "catalog_provider" | "quantity">) {
  const cart = readCart()
  const id = item.clientProductId.trim()
  if (!id) return
  if (cart.items.some((i) => i.clientProductId === id)) return
  cart.items.push({
    catalog_provider: "gen_health",
    clientProductId: id,
    quantity: 1,
    displayName: item.displayName,
    amountCents: item.amountCents,
    imageUrl: item.imageUrl,
  })
  writeCart(cart)
}

export function removeFromCart(clientProductId: string) {
  const cart = readCart()
  cart.items = cart.items.filter((i) => i.clientProductId !== clientProductId)
  writeCart(cart)
}

export function clearGenHealthCart() {
  writeCart({ items: [] })
}

export function toCheckoutProducts(cart: StoredCart) {
  return cart.items.map((i) => ({
    catalog_provider: "gen_health" as const,
    clientProductId: i.clientProductId,
    quantity: 1,
  }))
}

type Props = {
  accentColor: string
  checkoutPath: string
}

export default function GenHealthCartSummary(props: Partial<Props>) {
  const { accentColor = "#331110", checkoutPath = "/checkout" } = props
  const cart = useGenHealthCart()
  const subtotal = cart.items.reduce((sum, i) => sum + (i.amountCents ?? 0), 0)

  if (cart.items.length === 0) {
    return (
      <div style={{ padding: 24, color: "#64748b", textAlign: "center" }}>
        Your cart is empty.
      </div>
    )
  }

  return (
    <div
      style={{
        padding: 24,
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #e2e8f0",
        maxWidth: 480,
      }}
    >
      <h3 style={{ margin: "0 0 16px", fontSize: 18 }}>Cart ({cart.items.length})</h3>
      {cart.items.map((item) => (
        <div
          key={item.clientProductId}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            gap: 12,
          }}
        >
          <span>{item.displayName || item.clientProductId}</span>
          <button
            type="button"
            onClick={() => removeFromCart(item.clientProductId)}
            style={{
              border: "none",
              background: "transparent",
              color: "#64748b",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Remove
          </button>
        </div>
      ))}
      {subtotal > 0 && (
        <div style={{ fontWeight: 600, marginBottom: 16 }}>
          Subtotal: ${(subtotal / 100).toFixed(2)}
        </div>
      )}
      <a
        href={checkoutPath}
        style={{
          display: "inline-block",
          padding: "12px 20px",
          borderRadius: 999,
          background: accentColor,
          color: "#fff",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Checkout
      </a>
    </div>
  )
}

addPropertyControls(GenHealthCartSummary, {
  accentColor: { type: ControlType.Color, title: "Accent", defaultValue: "#331110" },
  checkoutPath: { type: ControlType.String, title: "Checkout Path", defaultValue: "/checkout" },
})
