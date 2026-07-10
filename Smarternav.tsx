import type { ComponentType } from "react"
import { useEffect, useRef, useState } from "react"

// Breakpoints matching Framer canvas variables
const MOBILE_BP = 375
const TABLET_BP = 768

export function withSmartNav(Component): ComponentType {
    return (props) => {
        const [hidden, setHidden] = useState(false)
        const [lastY, setLastY] = useState(0)
        const [isMobile, setIsMobile] = useState(false)
        const [isNavOpen, setIsNavOpen] = useState(false)
        const isHiddenRef = useRef(false) // track hidden state without triggering re-render in scroll handler
        const wrapperRef = useRef<HTMLDivElement>(null)

        // Track viewport size using Framer canvas breakpoints
        useEffect(() => {
            const checkBreakpoint = () =>
                setIsMobile(window.innerWidth <= TABLET_BP)
            checkBreakpoint()
            window.addEventListener("resize", checkBreakpoint)
            return () => window.removeEventListener("resize", checkBreakpoint)
        }, [])

        // Detect when mobile/tablet nav expands by watching wrapper height
        useEffect(() => {
            if (!wrapperRef.current) return
            const observer = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const height = entry.contentRect.height
                    setIsNavOpen(isMobile && height > 200)
                }
            })
            observer.observe(wrapperRef.current)
            return () => observer.disconnect()
        }, [isMobile])

        // Scroll behavior — keep hidden until genuine upward scroll
        useEffect(() => {
            const handleScroll = () => {
                const currentY = window.scrollY
                const delta = currentY - lastY

                if (delta > 0 && currentY > 100) {
                    // Scrolling down — hide
                    if (!isHiddenRef.current) {
                        isHiddenRef.current = true
                        setHidden(true)
                    }
                } else if (delta < -10) {
                    // Scrolling up intentionally — but only show if not at bottom of page
                    const atBottom =
                        window.innerHeight + currentY >=
                        document.documentElement.scrollHeight - 10
                    if (isHiddenRef.current && !atBottom) {
                        isHiddenRef.current = false
                        setHidden(false)
                    }
                }
                // delta === 0 (bottom of page bounce / no movement) → do nothing, preserve state

                setLastY(currentY)
            }

            window.addEventListener("scroll", handleScroll, { passive: true })
            return () => window.removeEventListener("scroll", handleScroll)
        }, [lastY])

        // Apply transform with !important to override Framer
        useEffect(() => {
            if (!wrapperRef.current) return
            const el = wrapperRef.current
            el.style.setProperty(
                "transition",
                "transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
                "important"
            )
            el.style.setProperty(
                "transform",
                hidden
                    ? "translateX(-50%) translateY(calc(-100% - 24px))"
                    : "translateX(-50%) translateY(0)",
                "important"
            )
            el.style.setProperty("will-change", "transform", "important")
        }, [hidden, isMobile])

        // top offset:
        // - Mobile/tablet open: 0px — expanded menu fills viewport edge to edge
        // - Everything else: 12px float
        const topOffset = isMobile && isNavOpen ? 0 : 12

        return (
            <div
                ref={wrapperRef}
                style={{
                    position: "fixed",
                    top: topOffset,
                    left: "50%",
                    transform: "translateX(-50%) translateY(0)",
                    width: isMobile ? "100%" : 1200,
                    maxWidth: "100%",
                    zIndex: 9999,
                    display: "flex",
                    justifyContent: "center",
                    transition: "top 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
                }}
            >
                <Component
                    {...props}
                    style={{
                        ...props.style,
                        width: isMobile ? "100%" : 1200,
                        maxWidth: "100%",
                    }}
                />
            </div>
        )
    }
}
