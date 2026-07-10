import { addPropertyControls, ControlType } from "framer"
import { addGenHealthToCart } from "./GenHealthCartStore"

type Props = {
  clientProductId: string
  displayName: string
  priceCents: number
  imageUrl: string
  accentColor: string
  label: string
}

export default function GenHealthAddToCartButton(props: Partial<Props>) {
  const {
    clientProductId = "",
    displayName = "",
    priceCents = 0,
    imageUrl = "",
    accentColor = "#331110",
    label = "Add to cart",
  } = props

  return (
    <button
      type="button"
      onClick={() =>
        addGenHealthToCart({
          clientProductId,
          displayName,
          amountCents: priceCents,
          imageUrl,
        })
      }
      style={{
        padding: "12px 24px",
        borderRadius: 999,
        border: "none",
        background: accentColor,
        color: "#fff",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  )
}

addPropertyControls(GenHealthAddToCartButton, {
  clientProductId: { type: ControlType.String, title: "Product ID", defaultValue: "" },
  displayName: { type: ControlType.String, title: "Display Name", defaultValue: "" },
  priceCents: { type: ControlType.Number, title: "Price (cents)", defaultValue: 0 },
  imageUrl: { type: ControlType.String, title: "Image URL", defaultValue: "" },
  accentColor: { type: ControlType.Color, title: "Accent", defaultValue: "#331110" },
  label: { type: ControlType.String, title: "Label", defaultValue: "Add to cart" },
})
