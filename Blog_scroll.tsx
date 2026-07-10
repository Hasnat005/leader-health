import { Override } from "framer"
import { useState, useEffect } from "react"

/**
 * ═══════════════════════════════════════════════════════════════
 *  SIMPLE HORIZONTAL SCROLL WITH TRIGGERS
 * ═══════════════════════════════════════════════════════════════
 *
 * SETUP (3 STEPS):
 *
 * 1. SELECT YOUR STACK → Apply "Scroll"
 * 2. SELECT LEFT ARROW → Apply "TriggerLeft"
 * 3. SELECT RIGHT ARROW → Apply "TriggerRight"
 *
 * Done! Your arrows will now control the scroll!
 */

// Store reference to scroll container
let container: HTMLElement | null = null

/**
 * STEP 1: Apply this to your STACK
 */
export function Scroll(): Override {
    return {
        ref: (element) => {
            container = element as HTMLElement
        },
        style: {
            overflowX: "scroll",
            overflowY: "hidden",
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
            msOverflowStyle: "none",
        },
    }
}

/**
 * STEP 2: Apply this to LEFT ARROW button/frame
 */
export function TriggerLeft(): Override {
    return {
        style: {
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
        },
        onTap: () => {
            if (container) {
                const scrollAmount = container.clientWidth * 0.8
                const newPosition = container.scrollLeft - scrollAmount
                container.scrollTo({
                    left: Math.max(0, newPosition),
                    behavior: "smooth",
                })
            }
        },
        whileTap: { scale: 0.95 },
    }
}

/**
 * STEP 3: Apply this to RIGHT ARROW button/frame
 */
export function TriggerRight(): Override {
    return {
        style: {
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
        },
        onTap: () => {
            if (container) {
                const scrollAmount = container.clientWidth * 0.8
                const newPosition = container.scrollLeft + scrollAmount
                const maxScroll = container.scrollWidth - container.clientWidth
                container.scrollTo({
                    left: Math.min(maxScroll, newPosition),
                    behavior: "smooth",
                })
            }
        },
        whileTap: { scale: 0.95 },
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  BONUS: SNAP TO CARDS
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Apply to STACK for snap-to-card behavior
 */
export function ScrollSnap(): Override {
    return {
        ref: (element) => {
            container = element as HTMLElement
        },
        style: {
            overflowX: "scroll",
            overflowY: "hidden",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
            msOverflowStyle: "none",
        },
    }
}

/**
 * Apply to EACH CARD for snap behavior
 */
export function SnapItem(): Override {
    return {
        style: {
            scrollSnapAlign: "start",
            scrollSnapStop: "always",
            flexShrink: 0,
        },
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  BONUS: ONE CARD AT A TIME
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Scroll exactly ONE card left
 */
export function OneCardLeft(): Override {
    return {
        style: {
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
        },
        onTap: () => {
            if (!container || !container.children.length) return

            const firstCard = container.children[0] as HTMLElement
            const cardWidth = firstCard.offsetWidth
            const gap = 20

            const newPosition = container.scrollLeft - (cardWidth + gap)
            container.scrollTo({
                left: Math.max(0, newPosition),
                behavior: "smooth",
            })
        },
        whileTap: { scale: 0.95 },
    }
}

/**
 * Scroll exactly ONE card right
 */
export function OneCardRight(): Override {
    return {
        style: {
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
        },
        onTap: () => {
            if (!container || !container.children.length) return

            const firstCard = container.children[0] as HTMLElement
            const cardWidth = firstCard.offsetWidth
            const gap = 20

            const newPosition = container.scrollLeft + (cardWidth + gap)
            const maxScroll = container.scrollWidth - container.clientWidth
            container.scrollTo({
                left: Math.min(maxScroll, newPosition),
                behavior: "smooth",
            })
        },
        whileTap: { scale: 0.95 },
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  BONUS: SMART ARROWS (hide when can't scroll)
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Left arrow that hides at start
 */
export function SmartLeft(): Override {
    return (Component) => {
        return (props) => {
            const [show, setShow] = useState(false)

            useEffect(() => {
                if (!container) return

                const check = () => {
                    setShow(container.scrollLeft > 10)
                }

                check()
                container.addEventListener("scroll", check, { passive: true })
                return () => container.removeEventListener("scroll", check)
            }, [])

            return (
                <Component
                    {...props}
                    style={{
                        ...props.style,
                        opacity: show ? 1 : 0.3,
                        pointerEvents: show ? "auto" : "none",
                        WebkitTapHighlightColor: "transparent",
                    }}
                    onTap={() => {
                        if (!container) return
                        const scrollAmount = container.clientWidth * 0.8
                        const newPosition = container.scrollLeft - scrollAmount
                        container.scrollTo({
                            left: Math.max(0, newPosition),
                            behavior: "smooth",
                        })
                    }}
                />
            )
        }
    }
}

/**
 * Right arrow that hides at end
 */
export function SmartRight(): Override {
    return (Component) => {
        return (props) => {
            const [show, setShow] = useState(true)

            useEffect(() => {
                if (!container) return

                const check = () => {
                    const atEnd =
                        container.scrollLeft >=
                        container.scrollWidth - container.clientWidth - 10
                    setShow(!atEnd)
                }

                check()
                container.addEventListener("scroll", check, { passive: true })
                return () => container.removeEventListener("scroll", check)
            }, [])

            return (
                <Component
                    {...props}
                    style={{
                        ...props.style,
                        opacity: show ? 1 : 0.3,
                        pointerEvents: show ? "auto" : "none",
                        WebkitTapHighlightColor: "transparent",
                    }}
                    onTap={() => {
                        if (!container) return
                        const scrollAmount = container.clientWidth * 0.8
                        const newPosition = container.scrollLeft + scrollAmount
                        const maxScroll =
                            container.scrollWidth - container.clientWidth
                        container.scrollTo({
                            left: Math.min(maxScroll, newPosition),
                            behavior: "smooth",
                        })
                    }}
                />
            )
        }
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  USAGE SUMMARY
 * ═══════════════════════════════════════════════════════════════
 *
 * BASIC SETUP:
 * Stack → Scroll
 * Left Arrow → TriggerLeft
 * Right Arrow → TriggerRight
 *
 * WITH SNAP:
 * Stack → ScrollSnap
 * Each Card → SnapItem
 * Left Arrow → TriggerLeft
 * Right Arrow → TriggerRight
 *
 * ONE CARD AT A TIME:
 * Stack → Scroll or ScrollSnap
 * Left Arrow → OneCardLeft
 * Right Arrow → OneCardRight
 *
 * SMART ARROWS (auto-hide):
 * Stack → Scroll or ScrollSnap
 * Left Arrow → SmartLeft
 * Right Arrow → SmartRight
 *
 * ═══════════════════════════════════════════════════════════════
 */
