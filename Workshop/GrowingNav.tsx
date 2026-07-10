// Growing Navigation Component - Fixed to display properly
import { useState, startTransition, type CSSProperties } from "react"
import { addPropertyControls, ControlType } from "framer"
import { motion } from "framer-motion"

interface NavItem {
    label: string
    link: string
}

interface GrowingNavProps {
    items: NavItem[]
    backgroundColor: string
    textColor: string
    hoverColor: string
    activeColor: string
    font: CSSProperties
    borderRadius: number
    padding: number
    gap: number
    style?: CSSProperties
}

/**
 * Growing Navigation Component
 * 
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 */
export default function GrowingNav(props: GrowingNavProps) {
    const {
        items = [
            { label: "Home", link: "/" },
            { label: "About", link: "/about" },
            { label: "Services", link: "/services" },
            { label: "Contact", link: "/contact" }
        ],
        backgroundColor = "#FFFFFF",
        textColor = "#000000",
        hoverColor = "#F5F5F5",
        activeColor = "#000000",
        font,
        borderRadius = 8,
        padding = 16,
        gap = 8,
    } = props

    const [activeIndex, setActiveIndex] = useState(0)
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

    const handleClick = (index: number) => {
        startTransition(() => {
            setActiveIndex(index)
        })
    }

    const isFixedWidth = props?.style?.width === "100%"

    return (
        <nav
            style={{
                ...props.style,
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: `${gap}px`,
                backgroundColor,
                borderRadius: `${borderRadius}px`,
                padding: `${padding}px`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                ...(isFixedWidth ? {} : { width: "max-content" }),
            }}
        >
            {items.map((item, index) => {
                const isActive = activeIndex === index
                const isHovered = hoveredIndex === index

                return (
                    <motion.a
                        key={index}
                        href={item.link}
                        onClick={(e) => {
                            e.preventDefault()
                            handleClick(index)
                        }}
                        onMouseEnter={() => startTransition(() => setHoveredIndex(index))}
                        onMouseLeave={() => startTransition(() => setHoveredIndex(null))}
                        style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "8px 16px",
                            color: isActive ? activeColor : textColor,
                            textDecoration: "none",
                            cursor: "pointer",
                            borderRadius: `${borderRadius - 4}px`,
                            backgroundColor: isHovered && !isActive ? hoverColor : "transparent",
                            transition: "background-color 0.2s ease, color 0.2s ease",
                            whiteSpace: "nowrap",
                            ...font,
                        }}
                        initial={{ scale: 1 }}
                        animate={{ 
                            scale: isActive ? 1.05 : 1,
                            fontWeight: isActive ? 600 : 500
                        }}
                        transition={{ 
                            type: "spring", 
                            stiffness: 300, 
                            damping: 20 
                        }}
                    >
                        {item.label}
                        {isActive && (
                            <motion.div
                                layoutId="activeIndicator"
                                style={{
                                    position: "absolute",
                                    bottom: -4,
                                    left: "10%",
                                    right: "10%",
                                    height: 2,
                                    backgroundColor: activeColor,
                                    borderRadius: 2,
                                }}
                                transition={{
                                    type: "spring",
                                    stiffness: 380,
                                    damping: 30,
                                }}
                            />
                        )}
                    </motion.a>
                )
            })}
        </nav>
    )
}

addPropertyControls(GrowingNav, {
    items: {
        type: ControlType.Array,
        title: "Nav Items",
        control: {
            type: ControlType.Object,
            controls: {
                label: {
                    type: ControlType.String,
                    title: "Label",
                    defaultValue: "Link",
                },
                link: {
                    type: ControlType.String,
                    title: "URL",
                    defaultValue: "/",
                },
            },
        },
        defaultValue: [
            { label: "Home", link: "/" },
            { label: "About", link: "/about" },
            { label: "Services", link: "/services" },
            { label: "Contact", link: "/contact" },
        ],
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#FFFFFF",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#000000",
    },
    hoverColor: {
        type: ControlType.Color,
        title: "Hover Color",
        defaultValue: "#F5F5F5",
    },
    activeColor: {
        type: ControlType.Color,
        title: "Active Color",
        defaultValue: "#000000",
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: "15px",
            variant: "Medium",
            letterSpacing: "-0.01em",
            lineHeight: "1em",
        },
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Border Radius",
        defaultValue: 8,
        min: 0,
        max: 32,
        step: 1,
        unit: "px",
    },
    padding: {
        type: ControlType.Number,
        title: "Padding",
        defaultValue: 16,
        min: 0,
        max: 48,
        step: 1,
        unit: "px",
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 8,
        min: 0,
        max: 32,
        step: 1,
        unit: "px",
    },
})
