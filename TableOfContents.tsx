import { addPropertyControls, ControlType } from "framer"
import { useEffect, useState } from "react"

export default function TableOfContents({
    title,
    fontFamily,
    fontSize,
    activeColor,
}) {
    const [headings, setHeadings] = useState([])
    const [activeId, setActiveId] = useState("")
    const [hoveredId, setHoveredId] = useState("")

    useEffect(() => {
        const timer = setTimeout(() => {
            const containers = Array.from(
                document.querySelectorAll("[class*='framer']")
            ).filter((el) => el.querySelector("h1, h2, h3"))

            if (containers.length === 0) return

            const content = containers.reduce((a, b) =>
                a.getBoundingClientRect().height >
                b.getBoundingClientRect().height
                    ? a
                    : b
            )

            const els = Array.from(
                content.querySelectorAll("h1, h2, h3")
            ).filter((el) => el.textContent.trim().length > 0)

            if (els.length === 0) return

            els.forEach((el, i) => {
                if (!el.id) el.id = `section-${i}`
            })

            setHeadings(
                els.map((el) => ({
                    id: el.id,
                    text: el.textContent.trim(),
                    level: el.tagName,
                }))
            )

            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((e) => {
                        if (e.isIntersecting) setActiveId(e.target.id)
                    })
                },
                { rootMargin: "-10% 0px -80% 0px" }
            )
            els.forEach((el) => observer.observe(el))
            return () => observer.disconnect()
        }, 800)

        return () => clearTimeout(timer)
    }, [])

    const toTitleCase = (str) =>
        str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                width: "100%",
            }}
        >
            {title && (
                <p
                    style={{
                        fontSize: 11,
                        fontFamily,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: "#331110",
                        marginBottom: 8,
                        margin: 0,
                    }}
                >
                    {title}
                </p>
            )}
            {headings.map((h) => {
                const isActive = activeId === h.id
                const isHovered = hoveredId === h.id

                return (
                    <div
                        key={h.id}
                        onClick={() =>
                            document.getElementById(h.id)?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                            })
                        }
                        onMouseEnter={() => setHoveredId(h.id)}
                        onMouseLeave={() => setHoveredId("")}
                        style={{
                            cursor: "pointer",
                            fontSize: fontSize || 14,
                            fontFamily,
                            fontWeight: h.level === "H2" ? 500 : 400,
                            paddingTop: 5,
                            paddingBottom: 5,
                            color: isActive
                                ? activeColor || "#000"
                                : isHovered
                                  ? activeColor || "#000"
                                  : "inherit",
                            opacity: isActive ? 1 : isHovered ? 0.75 : 0.45,
                            borderLeft: `2px solid ${isActive ? activeColor || "#000" : "transparent"}`,
                            paddingLeft: h.level === "H3" ? 14 : 6,
                            transition: "all 0.2s ease",
                            transform:
                                isHovered && !isActive
                                    ? "translateX(2px)"
                                    : "translateX(0px)",
                        }}
                    >
                        {toTitleCase(h.text)}
                    </div>
                )
            })}
        </div>
    )
}

addPropertyControls(TableOfContents, {
    title: { type: ControlType.String, defaultValue: "In this article" },
    fontSize: { type: ControlType.Number, defaultValue: 14, min: 10, max: 24 },
    activeColor: { type: ControlType.Color, defaultValue: "#000000" },
    fontFamily: { type: ControlType.String, defaultValue: "inherit" },
})
