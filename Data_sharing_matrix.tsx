import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * SharingTable — "Personal information category / Categories of
 * service providers / Categories of third parties"
 *
 * • Desktop / tablet (≥768px): normal HTML <table>
 * • Mobile (<768px): same table styling, stacked. The category itself
 *   acts as the section heading — no label on the first column.
 * • Fonts and colors editable in the property panel
 * • Copy lives in the ROWS constant below
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1000
 */

const HEADERS = {
    category: "Personal information category",
    providers: "Categories of service providers",
    thirdParties: "Categories of third parties",
}

const ROWS = [
    {
        category: "Personal identifiers (name, email, postal, phone)",
        providers:
            "IT infrastructure, customer-support tools, fraud-prevention, identity verification",
        thirdParties: "None",
    },
    {
        category: "Internet activity (cookies, pageviews) on non-PHI pages",
        providers: "Analytics providers, sales & marketing tools",
        thirdParties: "Ad networks (only with consent)",
    },
    {
        category: "Commercial information (purchases)",
        providers:
            "IT infrastructure, payment processors, sales & marketing tools",
        thirdParties: "None for PHI; ad networks (non-PHI only, with consent)",
    },
    {
        category: "Financial information (card data — tokenized)",
        providers: "Payment processors",
        thirdParties: "None",
    },
    {
        category: "Health data and PHI",
        providers:
            "Affiliated Provider Network, Pharmacies, Labs, technology vendors under BAA",
        thirdParties: "None",
    },
    {
        category: "Consumer communications (support messages)",
        providers:
            "Customer-support tools, governance/risk/compliance software",
        thirdParties: "None",
    },
    {
        category: "Government-ID and identity-verification data",
        providers: "Identity-verification providers, fraud-prevention",
        thirdParties: "None",
    },
]

export default function SharingTable(props) {
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
    const [width, setWidth] = useState(1000)

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
                            <div style={label}>{HEADERS.providers}</div>
                            <p style={value}>{row.providers}</p>
                        </div>

                        <div>
                            <div style={label}>{HEADERS.thirdParties}</div>
                            <p style={value}>{row.thirdParties}</p>
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
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "40%" }} />
                    <col style={{ width: "30%" }} />
                </colgroup>
                <thead>
                    <tr>
                        <th style={th}>{HEADERS.category}</th>
                        <th style={th}>{HEADERS.providers}</th>
                        <th style={th}>{HEADERS.thirdParties}</th>
                    </tr>
                </thead>
                <tbody>
                    {ROWS.map((row, i) => (
                        <tr key={i}>
                            <td style={td}>{row.category}</td>
                            <td style={td}>{row.providers}</td>
                            <td style={td}>{row.thirdParties}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

SharingTable.defaultProps = {
    textColor: "#331110",
    mutedColor: "#8A7268",
    borderColor: "#DBD4BD",
    headerBackground: "rgba(0,0,0,0)",
    cellPadding: 16,
}

addPropertyControls(SharingTable, {
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
