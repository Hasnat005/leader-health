import { addPropertyControls, ControlType } from "framer"

type Props = {
  label: string
  href: string
  accentColor: string
  textColor: string
  fontSize: number
  fontWeight: number
}

export default function ProductsNavLink(props: Partial<Props>) {
  const {
    label = "Products",
    href = "/products",
    accentColor = "#331110",
    textColor = "",
    fontSize = 15,
    fontWeight = 500,
  } = props

  const color = textColor || accentColor

  return (
    <a
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        borderRadius: 999,
        textDecoration: "none",
        color,
        fontSize,
        fontWeight,
        border: `1px solid ${accentColor}22`,
        background: `${accentColor}08`,
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${accentColor}14`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${accentColor}08`
      }}
    >
      {label}
    </a>
  )
}

addPropertyControls(ProductsNavLink, {
  label: { type: ControlType.String, title: "Label", defaultValue: "Products" },
  href: { type: ControlType.String, title: "Link", defaultValue: "/products" },
  accentColor: { type: ControlType.Color, title: "Accent", defaultValue: "#331110" },
  textColor: { type: ControlType.Color, title: "Text (optional)" },
  fontSize: { type: ControlType.Number, title: "Font Size", defaultValue: 15, min: 12, max: 20 },
  fontWeight: { type: ControlType.Number, title: "Font Weight", defaultValue: 500, min: 400, max: 700 },
})
