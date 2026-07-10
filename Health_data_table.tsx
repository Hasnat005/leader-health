import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * HealthDataTable — "Category of consumer health data / Categories of
 * recipients / Purpose"
 *
 * • Desktop / tablet (≥768px): normal HTML <table>
 * • Mobile (<768px): same table styling, stacked. The category itself
 *   acts as the section heading — no label on the first column.
 * • Fonts and colors editable in the property panel
 * • Copy lives in the ROWS constant below
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1200
 */

const HEADERS = {
    category: "Category of consumer health data",
    recipients: "Categories of recipients",
    purpose: "Purpose",
}

const ROWS = [
    {
        category: "Waitlist and interest data; self-reported health interests",
        recipients:
            "Technology/hosting and communications service providers; customer-support tools",
        purpose: "Deliver the Site and respond to your request",
    },
    {
        category: "Site activity and health-related inferences (non-PHI pages)",
        recipients:
            "Analytics providers (and, only with your consent, advertising partners)",
        purpose: "Measure and improve the Site",
    },
    {
        category: "Identity/fraud-signal data",
        recipients: "Identity-verification and fraud-prevention providers",
        purpose: "Prevent fraud and abuse",
    },
    {
        category: "Any consumer health data, as required",
        recipients: "Government or legal authorities",
        purpose: "Comply with law or lawful process",
    },
    {
        category: "Any consumer health data",
        recipients: "Leader Health corporate affiliates",
        purpose: "Operate the business, under this Policy",
    },
]

export default function HealthDataTable(props) {
    const {
        textColor,
        mutedColor,
        borderColor,
        headerBackground,
        bodyFont,
        headingFont,
        cellPadding,
        style,
    } = props

    const containerRef = useRef(null)
    const [width, setWidth] = useState(1200)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) setWidth(entry.contentRect.width)
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const isMobile = width < 768

    // ---------- MOBILE: same table styling, stacked ----------
    if (isMobile) {
        const label = {
            ...headingFont,
            color: textColor,
            fontWeight: 700,
            marginBottom: 4,
        }
        const value = {
            ...bodyFont,
            color: textColor,
            margin: 0,
            lineHeight: 1.55,
        }
        return (
            <div ref={containerRef} style={{ width: "100%", ...style }}>
                {ROWS.map((row, i) => (
                    <div
                        key={i}
                        style={{
                            padding: `${cellPadding + 4}px 0`,
                            borderTop:
                                i === 0
                                    ? `2px solid ${borderColor}`
                                    : `1px solid ${borderColor}`,
                            borderBottom:
                                i === ROWS.length - 1
                                    ? `2px solid ${borderColor}`
                                    : "none",
                            display: "flex",
                            flexDirection: "column",
                            gap: 14,
                        }}
                    >
                        {/* Category — acts as the heading, no label */}
                        <p
                            style={{
                                ...value,
                                ...headingFont,
                                color: textColor,
                                fontWeight: 700,
                            }}
                        >
                            {row.category}
                        </p>

                        <div>
                            <div style={label}>{HEADERS.recipients}</div>
                            <p style={value}>{row.recipients}</p>
                        </div>

                        <div>
                            <div style={label}>{HEADERS.purpose}</div>
                            <p style={value}>{row.purpose}</p>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    // ---------- DESKTOP / TABLET: normal HTML table ----------
    const th = {
        ...headingFont,
        color: textColor,
        fontWeight: 700,
        textAlign: "left",
        padding: cellPadding,
        borderBottom: `2px solid ${borderColor}`,
        background: headerBackground,
        verticalAlign: "bottom",
    }

    const td = {
        ...bodyFont,
        color: textColor,
        padding: cellPadding,
        borderBottom: `1px solid ${borderColor}`,
        verticalAlign: "top",
        lineHeight: 1.55,
    }

    return (
        <div ref={containerRef} style={{ width: "100%", ...style }}>
            <table
                style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    tableLayout: "fixed",
                }}
            >
                <colgroup>
                    <col style={{ width: "32%" }} />
                    <col style={{ width: "40%" }} />
                    <col style={{ width: "28%" }} />
                </colgroup>
                <thead>
                    <tr>
                        <th style={th}>{HEADERS.category}</th>
                        <th style={th}>{HEADERS.recipients}</th>
                        <th style={th}>{HEADERS.purpose}</th>
                    </tr>
                </thead>
                <tbody>
                    {ROWS.map((row, i) => (
                        <tr key={i}>
                            <td style={td}>{row.category}</td>
                            <td style={td}>{row.recipients}</td>
                            <td style={td}>{row.purpose}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

HealthDataTable.defaultProps = {
    textColor: "#331110",
    mutedColor: "#8A7268",
    borderColor: "#DBD4BD",
    headerBackground: "rgba(0,0,0,0)",
    cellPadding: 16,
}

addPropertyControls(HealthDataTable, {
    bodyFont: {
        type: ControlType.Font,
        title: "Body Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 15, lineHeight: "1.55em" },
    },
    headingFont: {
        type: ControlType.Font,
        title: "Heading Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 15, lineHeight: "1.3em" },
    },
    textColor: {
        type: ControlType.Color,
        title: "Text",
        defaultValue: "#331110",
    },
    mutedColor: {
        type: ControlType.Color,
        title: "Muted Text",
        defaultValue: "#8A7268",
    },
    borderColor: {
        type: ControlType.Color,
        title: "Borders",
        defaultValue: "#DBD4BD",
    },
    headerBackground: {
        type: ControlType.Color,
        title: "Header Row BG",
        defaultValue: "rgba(0,0,0,0)",
    },
    cellPadding: {
        type: ControlType.Number,
        title: "Cell Padding",
        min: 4,
        max: 40,
        step: 2,
        defaultValue: 16,
        displayStepper: true,
    },
})
