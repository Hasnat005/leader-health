import { ComponentType, useEffect, useState } from "react"

export function withScrollToTop(Component: ComponentType): ComponentType {
    return (props) => {
        const [visible, setVisible] = useState(false)

        useEffect(() => {
            const scrollContainer =
                document.querySelector("[data-framer-page-scroll]") ||
                document.querySelector(".framer-page") ||
                window

            const handleScroll = () => {
                const scrollY =
                    scrollContainer === window
                        ? window.scrollY
                        : (scrollContainer as Element).scrollTop
                setVisible(scrollY > 300)
            }

            scrollContainer.addEventListener("scroll", handleScroll, {
                passive: true,
            })
            return () =>
                scrollContainer.removeEventListener("scroll", handleScroll)
        }, [])

        const handleClick = () => {
            const scrollContainer =
                document.querySelector("[data-framer-page-scroll]") ||
                document.querySelector(".framer-page") ||
                window

            if (scrollContainer === window) {
                window.scrollTo({ top: 0, behavior: "smooth" })
            } else {
                ;(scrollContainer as Element).scrollTo({
                    top: 0,
                    behavior: "smooth",
                })
            }
        }

        return (
            <div
                onClick={handleClick}
                style={{
                    position: "fixed",
                    bottom: "40px",
                    right: "40px",
                    zIndex: 9999,
                    opacity: visible ? 1 : 0,
                    pointerEvents: visible ? "auto" : "none",
                    transform: visible ? "translateY(0)" : "translateY(16px)",
                    transition: "opacity 0.3s ease, transform 0.3s ease",
                    cursor: "pointer",
                }}
            >
                <Component {...props} />
            </div>
        )
    }
}
