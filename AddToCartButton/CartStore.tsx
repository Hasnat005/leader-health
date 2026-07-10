import { addPropertyControls, ControlType } from "framer"
import { useSyncExternalStore } from "react"

// --- cart store ---
const KEY = "cart"
const listeners = new Set<() => void>()

function read() {
    if (typeof localStorage === "undefined") return []
    try {
        return JSON.parse(localStorage.getItem(KEY) || "[]")
    } catch {
        return []
    }
}
function write(items: any[]) {
    localStorage.setItem(KEY, JSON.stringify(items))
    listeners.forEach((l) => l())
}
export function useCart() {
    return useSyncExternalStore(
        (cb) => {
            listeners.add(cb)
            return () => listeners.delete(cb)
        },
        read,
        () => []
    )
}
function addToCart(item: any) {
    const cart = read()
    const existing = cart.find((i: any) => i.productId === item.productId)
    if (existing) existing.qty += 1
    else cart.push({ ...item, qty: 1 })
    write(cart)
}

// --- button ---
export default function AddToCartButton(props: any) {
    return (
        <button
            onClick={() =>
                addToCart({
                    productId: props.productId,
                    name: props.name,
                    price: props.price,
                    image: props.image,
                })
            }
            style={{ padding: "12px 24px", borderRadius: 8, cursor: "pointer" }}
        >
            Add to Cart
        </button>
    )
}

addPropertyControls(AddToCartButton, {
    productId: { type: ControlType.String, title: "Product ID" },
    name: { type: ControlType.String, title: "Name" },
    price: { type: ControlType.Number, title: "Price" },
    image: { type: ControlType.Image, title: "Image" },
})
