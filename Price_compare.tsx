import { addPropertyControls, ControlType, RenderTarget } from "framer"
import { useRef } from "react"
import { motion, useInView, useReducedMotion } from "framer-motion"

/**
 * PriceComparison — Leader Health vs competitors (honest scale)
 *
 * • Bar lengths are COMPUTED from the actual max price you enter,
 *   anchored at $0 — the visual ratio always equals the price ratio.
 * • Responsive via CSS container queries (no JS measuring), so it
 *   adapts correctly on the Framer canvas, preview, AND live site:
 *   desktop ≥768 / tablet 480–767 / mobile <480 — based on the
 *   component's own width, so it works inside any breakpoint frame.
 * • Logo upload, scroll-in animation, canvas-safe.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 900
 */
export default function PriceComparison(props) {
    const {
        logo,
        logoHeight,
        brandName,
        brandPriceLabel,
        brandMaxPrice,
        brandBarStart,
        brandBarEnd,
        competitors,
        competitorBarColor,
        competitorPriceColor,
        labelColor,
        labelFont,
        priceFont,
        labelWidth,
        barHeight,
        barRadius,
        rowGap,
        stagger,
        duration,
        style,
    } = props

    const containerRef = useRef(null)
    const inView = useInView(containerRef, { once: true, amount: 0.3 })
    const reduceMotion = useReducedMotion()

    const onCanvas = RenderTarget.current() === RenderTarget.canvas
    const showFinal = onCanvas || reduceMotion || inView

    const rows = [
        {
            isBrand: true,
            name: brandName,
            price: brandPriceLabel,
            maxPrice: brandMaxPrice,
        },
        ...(competitors || []).map((c) => ({
            isBrand: false,
            name: c.name,
            price: c.priceLabel,
            maxPrice: c.maxPrice,
        })),
    ]

    // Honest scale: every bar is (its max price / highest max price),
    // anchored at $0. The visual ratio always equals the price ratio.
    const highest = Math.max(...rows.map((r) => r.maxPrice || 0), 1)
    const percentFor = (r) =>
        Math.max(2, Math.round(((r.maxPrice || 0) / highest) * 100))

    const spring = { type: "spring", stiffness: 90, damping: 18 }
    const tabletLabelWidth = Math.min(labelWidth, 130)

    return (
        <div
            ref={containerRef}
            className="pc-outer"
            style={{ width: "100%", ...style }}
        >
            <style>{`
                .pc-outer {
                    container-type: inline-size;
                }
                .pc-list {
                    display: flex;
                    flex-direction: column;
                    gap: ${rowGap}px;
                    width: 100%;
                }
                .pc-row {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    gap: 16px;
                    width: 100%;
                }
                .pc-label {
                    width: ${labelWidth}px;
                    min-width: ${labelWidth}px;
                    max-width: ${labelWidth}px;
                    flex-shrink: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    overflow: hidden;
                }
                .pc-logo {
                    height: ${logoHeight}px;
                    max-height: ${logoHeight}px;
                    width: auto;
                    max-width: 100%;
                    object-fit: contain;
                    object-position: center center;
                    display: block;
                }
                .pc-track {
                    flex-grow: 1;
                    flex-basis: 0;
                    position: relative;
                    min-width: 0;
                    min-height: ${barHeight}px;
                }

                /* Tablet: narrower label column keeps bars wide */
                @container (max-width: 767px) {
                    .pc-label {
                        width: ${tabletLabelWidth}px;
                        min-width: ${tabletLabelWidth}px;
                        max-width: ${tabletLabelWidth}px;
                    }
                }

                /* Mobile: stack label above a full-width bar */
                @container (max-width: 479px) {
                    .pc-row {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 8px;
                    }
                    .pc-label {
                        width: 100%;
                        min-width: 100%;
                        max-width: 100%;
                        justify-content: flex-start;
                    }
                    .pc-logo {
                        object-position: left center;
                    }
                    .pc-track {
                        width: 100%;
                    }
                }
            `}</style>

            <div className="pc-list">
                {rows.map((row, i) => {
                    const percent = percentFor(row)
                    const barColor = row.isBrand
                        ? `linear-gradient(180deg, ${brandBarStart} 0%, ${brandBarEnd} 100%)`
                        : `linear-gradient(180deg, ${competitorBarColor} 0%, ${shade(competitorBarColor, -18)} 100%)`
                    const delay = showFinal && !inView ? 0 : i * stagger

                    const label = row.isBrand ? (
                        logo?.src ? (
                            <img
                                className="pc-logo"
                                src={logo.src}
                                srcSet={logo.srcSet}
                                alt={logo.alt || brandName}
                            />
                        ) : (
                            <span
                                style={{
                                    ...labelFont,
                                    color: labelColor,
                                    fontWeight: 800,
                                    letterSpacing: "0.02em",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    maxWidth: "100%",
                                }}
                            >
                                {brandName}
                            </span>
                        )
                    ) : (
                        <span
                            style={{
                                ...labelFont,
                                color: labelColor,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: "100%",
                            }}
                        >
                            {row.name}
                        </span>
                    )

                    return (
                        <motion.div
                            key={i}
                            className="pc-row"
                            initial={
                                onCanvas || reduceMotion
                                    ? false
                                    : { opacity: 0, y: 12 }
                            }
                            animate={
                                showFinal
                                    ? { opacity: 1, y: 0 }
                                    : { opacity: 0, y: 12 }
                            }
                            transition={{ ...spring, delay }}
                        >
                            <div className="pc-label">{label}</div>

                            <div className="pc-track">
                                <motion.div
                                    initial={
                                        onCanvas || reduceMotion
                                            ? false
                                            : { width: 0 }
                                    }
                                    animate={{
                                        width: showFinal ? `${percent}%` : 0,
                                    }}
                                    transition={{
                                        ...spring,
                                        duration,
                                        delay: delay + 0.1,
                                    }}
                                    style={{
                                        height: barHeight,
                                        borderRadius: barRadius,
                                        background: barColor,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "flex-end",
                                        paddingRight: 16,
                                        boxShadow: row.isBrand
                                            ? `0 4px 14px ${brandBarEnd}55`
                                            : "0 3px 10px rgba(51,17,16,0.25)",
                                        overflow: "hidden",
                                        minWidth: barHeight,
                                    }}
                                >
                                    <motion.span
                                        initial={
                                            onCanvas || reduceMotion
                                                ? false
                                                : { opacity: 0 }
                                        }
                                        animate={{
                                            opacity: showFinal ? 1 : 0,
                                        }}
                                        transition={{
                                            delay: delay + 0.35,
                                            duration: 0.4,
                                        }}
                                        style={{
                                            ...priceFont,
                                            color: row.isBrand
                                                ? "#FFFFFF"
                                                : competitorPriceColor,
                                            fontWeight: row.isBrand
                                                ? 700
                                                : priceFont?.fontWeight || 600,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {row.price}
                                    </motion.span>
                                </motion.div>
                            </div>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}

/** Darken/lighten a hex color by a percentage (-100 to 100) */
function shade(hex, percent) {
    try {
        const num = parseInt(hex.replace("#", ""), 16)
        const amt = Math.round(2.55 * percent)
        const r = Math.min(255, Math.max(0, (num >> 16) + amt))
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt))
        const b = Math.min(255, Math.max(0, (num & 0xff) + amt))
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
    } catch (e) {
        return hex
    }
}

PriceComparison.defaultProps = {
    brandName: "LEADERHEALTH",
    brandPriceLabel: "$49 - $109/mo",
    brandMaxPrice: 109,
    brandBarStart: "#F37477",
    brandBarEnd: "#E33D4D",
    competitors: [
        { name: "Hims", priceLabel: "$40 - $120+/mo", maxPrice: 120 },
        { name: "Maximus", priceLabel: "$50 - $120+/mo", maxPrice: 120 },
        { name: "HONE HEALTH", priceLabel: "$50 - $120+/mo", maxPrice: 120 },
    ],
    competitorBarColor: "#331110",
    competitorPriceColor: "#F7F3F5",
    labelColor: "#331110",
    logoHeight: 24,
    labelWidth: 170,
    barHeight: 44,
    barRadius: 10,
    rowGap: 28,
    stagger: 0.15,
    duration: 0.8,
}

addPropertyControls(PriceComparison, {
    logo: {
        type: ControlType.ResponsiveImage,
        title: "Logo",
    },
    logoHeight: {
        type: ControlType.Number,
        title: "Logo Height",
        min: 12,
        max: 80,
        step: 1,
        defaultValue: 24,
        displayStepper: true,
    },
    labelWidth: {
        type: ControlType.Number,
        title: "Label Width",
        min: 80,
        max: 320,
        step: 5,
        defaultValue: 170,
        displayStepper: true,
    },
    brandName: {
        type: ControlType.String,
        title: "Brand Name",
        defaultValue: "LEADERHEALTH",
    },
    brandPriceLabel: {
        type: ControlType.String,
        title: "Brand Price Text",
        defaultValue: "$49 - $109/mo",
    },
    brandMaxPrice: {
        type: ControlType.Number,
        title: "Brand Max $",
        min: 1,
        max: 1000,
        defaultValue: 109,
        displayStepper: true,
    },
    brandBarStart: {
        type: ControlType.Color,
        title: "Brand Bar Top",
        defaultValue: "#F37477",
    },
    brandBarEnd: {
        type: ControlType.Color,
        title: "Brand Bar Bottom",
        defaultValue: "#E33D4D",
    },
    competitors: {
        type: ControlType.Array,
        title: "Competitors",
        control: {
            type: ControlType.Object,
            controls: {
                name: {
                    type: ControlType.String,
                    title: "Name",
                    defaultValue: "Competitor",
                },
                priceLabel: {
                    type: ControlType.String,
                    title: "Price Text",
                    defaultValue: "$50 - $120+/mo",
                },
                maxPrice: {
                    type: ControlType.Number,
                    title: "Max $",
                    min: 1,
                    max: 1000,
                    defaultValue: 120,
                    displayStepper: true,
                },
            },
        },
        defaultValue: [
            { name: "Hims", priceLabel: "$40 - $120+/mo", maxPrice: 120 },
            { name: "Maximus", priceLabel: "$50 - $120+/mo", maxPrice: 120 },
            {
                name: "HONE HEALTH",
                priceLabel: "$50 - $120+/mo",
                maxPrice: 120,
            },
        ],
        maxCount: 8,
    },
    competitorBarColor: {
        type: ControlType.Color,
        title: "Competitor Bar",
        defaultValue: "#331110",
    },
    competitorPriceColor: {
        type: ControlType.Color,
        title: "Price (in bar)",
        defaultValue: "#F7F3F5",
    },
    labelColor: {
        type: ControlType.Color,
        title: "Label Color",
        defaultValue: "#331110",
    },
    labelFont: {
        type: ControlType.Font,
        title: "Label Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 17, lineHeight: "1.2em" },
    },
    priceFont: {
        type: ControlType.Font,
        title: "Price Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 17,
            fontWeight: 600,
            lineHeight: "1.2em",
        },
    },
    barHeight: {
        type: ControlType.Number,
        title: "Bar Height",
        min: 20,
        max: 80,
        defaultValue: 44,
        displayStepper: true,
    },
    barRadius: {
        type: ControlType.Number,
        title: "Bar Radius",
        min: 0,
        max: 40,
        defaultValue: 10,
        displayStepper: true,
    },
    rowGap: {
        type: ControlType.Number,
        title: "Row Gap",
        min: 8,
        max: 64,
        defaultValue: 28,
        displayStepper: true,
    },
    stagger: {
        type: ControlType.Number,
        title: "Stagger (s)",
        min: 0,
        max: 0.5,
        step: 0.05,
        defaultValue: 0.15,
    },
    duration: {
        type: ControlType.Number,
        title: "Duration (s)",
        min: 0.2,
        max: 2,
        step: 0.1,
        defaultValue: 0.8,
    },
})
