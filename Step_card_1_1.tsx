import * as React from "react"
import { motion } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

/* ---------- Types ---------- */
type Step = {
    title: string
    description?: string
    image?: {
        src?: string
        srcSet?: string
        alt?: string
        positionX?: string
        positionY?: string
    }
}

/* ---------- Arrow Button ---------- */
function ArrowButton({
    direction = "left",
    size = 40,
    radius = 10,
    bg = "#F2F4F7",
    icon = "#0F172A",
    strokeWidth = 2,
    onClick,
    ariaLabel,
}: {
    direction?: "left" | "right"
    size?: number
    radius?: number
    bg?: string
    icon?: string
    strokeWidth?: number
    onClick?: () => void
    ariaLabel?: string
}) {
    return (
        <button
            onClick={onClick}
            aria-label={
                ariaLabel || (direction === "left" ? "Previous" : "Next")
            }
            style={{
                width: size,
                height: size,
                borderRadius: radius,
                border: "none",
                background: bg,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                boxShadow:
                    "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.10)",
                padding: 0,
            }}
        >
            <ArrowIcon
                direction={direction}
                color={icon}
                strokeWidth={strokeWidth}
            />
        </button>
    )
}

function ArrowIcon({
    direction = "left",
    size = 20,
    color = "#0F172A",
    strokeWidth = 2,
}: {
    direction?: "left" | "right"
    size?: number
    color?: string
    strokeWidth?: number
}) {
    const common = {
        fill: "none",
        stroke: color,
        strokeWidth,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
    }
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            {direction === "left" ? (
                <>
                    <polyline {...common} points="15 18 9 12 15 6" />
                    <line {...common} x1="21" y1="12" x2="9" y2="12" />
                </>
            ) : (
                <>
                    <polyline {...common} points="9 6 15 12 9 18" />
                    <line {...common} x1="3" y1="12" x2="15" y2="12" />
                </>
            )}
        </svg>
    )
}

/* ---------- Main Component ---------- */
export default function StepCarousel(props: {
    steps: Step[]
    cardWidth?: number
    cardHeight?: number
    cardRadius?: number
    shadow?: number
    transitionMs?: number
    dimScale?: number
    dimOpacity?: number
    controlsGap?: number
    padTop?: number
    padRight?: number
    padBottom?: number
    padLeft?: number
    fontFamily?: any // Framer Font object
    textColor?: string
    titleSize?: number
    descSize?: number

    // ✅ New: Show/hide step count
    showStepCount?: boolean
    stepCountSize?: number
    stepCountColor?: string

    // ✅ New: Individual text colors
    titleColor?: string
    descriptionColor?: string

    autoplay?: boolean
    autoplayInterval?: number
    pauseOnHover?: boolean
}) {
    const {
        steps,
        cardWidth = 740,
        cardHeight = 280,
        cardRadius = 24,
        shadow = 0.18,
        transitionMs = 420,
        dimScale = 0.92,
        dimOpacity = 0.5,
        controlsGap = 56,
        padTop = 24,
        padRight = 24,
        padBottom = 22,
        padLeft = 24,
        fontFamily,
        textColor = "#111111",
        titleSize = 28,
        descSize = 16,

        // ✅ New controls
        showStepCount = true,
        stepCountSize = 14,
        stepCountColor = "#111111",
        titleColor = "#111111",
        descriptionColor = "#111111",

        autoplay = false,
        autoplayInterval = 4000,
        pauseOnHover = true,
    } = props

    const [index, setIndex] = React.useState(0)
    const [isHovered, setIsHovered] = React.useState(false)
    const len = steps.length || 1

    const next = React.useCallback(() => setIndex((i) => (i + 1) % len), [len])
    const prev = React.useCallback(
        () => setIndex((i) => (i - 1 + len) % len),
        [len]
    )

    // ✅ Autoplay effect
    React.useEffect(() => {
        if (!autoplay) return
        if (pauseOnHover && isHovered) return

        const timer = setInterval(() => {
            setIndex((i) => (i + 1) % len)
        }, autoplayInterval)

        return () => clearInterval(timer)
    }, [autoplay, autoplayInterval, pauseOnHover, isHovered, len])

    // Keyboard navigation
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") next()
            if (e.key === "ArrowLeft") prev()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [next, prev])

    const roleOf = (i: number) => {
        if (i === index) return "active" as const
        if (i === (index - 1 + len) % len) return "prev" as const
        if (i === (index + 1) % len) return "next" as const
        return "hidden" as const
    }

    const t = (ms: number) => ({
        duration: ms / 1000,
        ease: [0.4, 0.0, 0.2, 1], // Custom easing for smoother effect
    })

    // ✅ Extract font from Framer Font object
    const appliedFont = React.useMemo(() => {
        if (!fontFamily) {
            return "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        }

        // If it's a string, use directly
        if (typeof fontFamily === "string") {
            return fontFamily
        }

        // If it's a Framer Font object, it might have different structures
        if (typeof fontFamily === "object") {
            // Try common Framer font object properties
            return (
                fontFamily.family ||
                fontFamily.fontFamily ||
                fontFamily.name ||
                String(fontFamily)
            )
        }

        return String(fontFamily)
    }, [fontFamily])

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                position: "relative",
                width: cardWidth,
                height: cardHeight + controlsGap + 44,
                margin: "0 auto",
                fontFamily: appliedFont,
            }}
        >
            {/* Stage */}
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: cardHeight,
                }}
            >
                {steps.map((step, i) => {
                    const role = roleOf(i)

                    // Skip rendering hidden cards for performance
                    if (role === "hidden") return null

                    const layout =
                        role === "active"
                            ? { scale: 1, opacity: 1, y: 0, z: 3 }
                            : role === "prev"
                              ? {
                                    scale: dimScale,
                                    opacity: dimOpacity,
                                    y: -40, // Increased from -24 for more visible effect
                                    z: 2,
                                }
                              : {
                                    // next
                                    scale: dimScale,
                                    opacity: dimOpacity,
                                    y: 40, // Increased from 24 for more visible effect
                                    z: 1,
                                }

                    return (
                        <motion.div
                            key={i}
                            initial={false}
                            animate={{
                                scale: layout.scale,
                                opacity: layout.opacity,
                                y: layout.y,
                            }}
                            transition={t(transitionMs)}
                            style={{
                                position: "absolute",
                                inset: 0,
                                borderRadius: cardRadius,
                                overflow: "hidden",
                                background: "#fff",
                                boxShadow: `0 10px 30px rgba(0,0,0,${shadow})`,
                                zIndex: layout.z,
                                pointerEvents:
                                    role === "active" ? "auto" : "none",
                                willChange: "transform, opacity",
                            }}
                        >
                            {/* Background */}
                            {step.image?.src ? (
                                <img
                                    src={step.image.src}
                                    srcSet={step.image.srcSet}
                                    alt={step.image.alt ?? ""}
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        objectPosition: `${step.image.positionX || "50%"} ${step.image.positionY || "50%"}`,
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        background: "#ffffff",
                                    }}
                                />
                            )}

                            {step.image?.src && (
                                <div
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        background:
                                            "linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.06) 30%, rgba(0,0,0,0.12) 100%)",
                                        pointerEvents: "none",
                                    }}
                                />
                            )}

                            {/* Content */}
                            <div
                                style={{
                                    position: "absolute",
                                    top: padTop,
                                    right: padRight,
                                    bottom: padBottom,
                                    left: padLeft,
                                    color: textColor,
                                }}
                            >
                                {showStepCount && (
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: stepCountSize,
                                            opacity: 0.9,
                                            color: stepCountColor,
                                        }}
                                    >
                                        Step {i + 1}
                                    </p>
                                )}
                                <h2
                                    style={{
                                        margin: showStepCount
                                            ? "6px 0 8px"
                                            : "0 0 8px",
                                        fontSize: titleSize,
                                        lineHeight: 1.1,
                                        color: titleColor,
                                    }}
                                >
                                    {step.title}
                                </h2>
                                {step.description && (
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: descSize,
                                            opacity: 0.85,
                                            color: descriptionColor,
                                        }}
                                    >
                                        {step.description}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            {/* Controls */}
            <div
                style={{
                    position: "absolute",
                    top: cardHeight + controlsGap,
                    left: 0,
                    right: 0,
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <ArrowButton direction="left" onClick={prev} />
                <ArrowButton direction="right" onClick={next} />
            </div>
        </div>
    )
}

/* ---------- Defaults ---------- */
StepCarousel.defaultProps = {
    steps: [
        {
            title: "Personal Mentorship",
            description:
                "We understand your goals and profile — no cookie-cutter advice",
        },
        {
            title: "University Guidance",
            description: "Get tailored shortlists and application support",
        },
        {
            title: "Visa & Career Support",
            description: "Navigate your move abroad with experts backing you",
        },
    ],
    cardWidth: 740,
    cardHeight: 280,
    cardRadius: 24,
    shadow: 0.18,
    transitionMs: 420,
    dimScale: 0.92,
    dimOpacity: 0.5,
    controlsGap: 56,
    padTop: 24,
    padRight: 24,
    padBottom: 22,
    padLeft: 24,
    textColor: "#111111",
    titleSize: 28,
    descSize: 16,
    showStepCount: true,
    stepCountSize: 14,
    stepCountColor: "#111111",
    titleColor: "#111111",
    descriptionColor: "#111111",
    autoplay: false,
    autoplayInterval: 4000,
    pauseOnHover: true,
}

/* ---------- Framer Controls ---------- */
addPropertyControls(StepCarousel, {
    steps: {
        type: ControlType.Array,
        title: "Steps",
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String, title: "Title" },
                description: { type: ControlType.String, title: "Description" },
                image: { type: ControlType.ResponsiveImage, title: "Image" },
            },
        },
    },
    cardWidth: {
        type: ControlType.Number,
        title: "Card Width",
        min: 100,
        max: 1400,
        step: 10,
    },
    cardHeight: {
        type: ControlType.Number,
        title: "Card Height",
        min: 100,
        max: 700,
        step: 10,
    },
    cardRadius: {
        type: ControlType.Number,
        title: "Radius",
        min: 0,
        max: 40,
        step: 1,
    },
    shadow: {
        type: ControlType.Number,
        title: "Shadow",
        min: 0,
        max: 0.5,
        step: 0.01,
    },
    transitionMs: {
        type: ControlType.Number,
        title: "Transition (ms)",
        min: 120,
        max: 1000,
        step: 20,
    },
    dimScale: {
        type: ControlType.Number,
        title: "Dim Scale",
        min: 0.85,
        max: 0.98,
        step: 0.01,
    },
    dimOpacity: {
        type: ControlType.Number,
        title: "Dim Opacity",
        min: 0,
        max: 1,
        step: 0.05,
    },
    controlsGap: {
        type: ControlType.Number,
        title: "Arrows Gap",
        min: 0,
        max: 200,
        step: 2,
    },
    padTop: {
        type: ControlType.Number,
        title: "Pad Top",
        min: 0,
        max: 120,
        step: 2,
    },
    padRight: {
        type: ControlType.Number,
        title: "Pad Right",
        min: 0,
        max: 120,
        step: 2,
    },
    padBottom: {
        type: ControlType.Number,
        title: "Pad Bottom",
        min: 0,
        max: 120,
        step: 2,
    },
    padLeft: {
        type: ControlType.Number,
        title: "Pad Left",
        min: 0,
        max: 120,
        step: 2,
    },
    fontFamily: {
        type: ControlType.Font,
        title: "Font Family",
    },
    textColor: {
        type: ControlType.Color,
        title: "General Text Color",
        description: "Fallback color for all text",
    },

    // ✅ Step Count Controls
    showStepCount: {
        type: ControlType.Boolean,
        title: "Show Step Count",
        defaultValue: true,
    },
    stepCountSize: {
        type: ControlType.Number,
        title: "Step Count Size",
        min: 10,
        max: 24,
        step: 1,
        defaultValue: 14,
        hidden(props) {
            return !props.showStepCount
        },
    },
    stepCountColor: {
        type: ControlType.Color,
        title: "Step Count Color",
        defaultValue: "#111111",
        hidden(props) {
            return !props.showStepCount
        },
    },

    // ✅ Individual Text Color Controls
    titleColor: {
        type: ControlType.Color,
        title: "Title Color",
        defaultValue: "#111111",
    },
    titleSize: {
        type: ControlType.Number,
        title: "Title Size",
        min: 10,
        max: 64,
        step: 1,
    },
    descriptionColor: {
        type: ControlType.Color,
        title: "Description Color",
        defaultValue: "#111111",
    },
    descSize: {
        type: ControlType.Number,
        title: "Desc Size",
        min: 10,
        max: 40,
        step: 1,
    },

    autoplay: {
        type: ControlType.Boolean,
        title: "Autoplay",
        defaultValue: false,
    },
    autoplayInterval: {
        type: ControlType.Number,
        title: "Interval (ms)",
        min: 1000,
        max: 10000,
        step: 500,
        hidden(props) {
            return !props.autoplay
        },
    },
    pauseOnHover: {
        type: ControlType.Boolean,
        title: "Pause on Hover",
        defaultValue: true,
        hidden(props) {
            return !props.autoplay
        },
    },
})
