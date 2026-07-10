import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * RetentionTable — "Type of data / Retention period"
 *
 * • Desktop / tablet (≥768px): normal HTML <table>
 * • Mobile (<768px): same table styling, stacked. The data type itself
 *   acts as the section heading — no label on the first column.
 * • Fonts and colors editable in the property panel
 * • Copy lives in the ROWS constant below (bold preserved)
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1000
 */

const HEADERS = {
    type: "Type of data",
    retention: "Retention period",
}

const ROWS = [
    {
        type: "Cookies and online data collected through Site use (online identifiers, internet activity)",
        retention: <>Deleted or anonymized within 18 months of collection</>,
    },
    {
        type: "Order, prescription, and shipping data necessary to fulfill the Service (name, address, phone, government ID where required, purchases, payment tokens)",
        retention: (
            <>
                For as long as needed to fulfill the contract and for 15 years
                after your last interaction with the Service, except where
                federal or state law (medical or pharmacy records) requires
                longer
            </>
        ),
    },
    {
        type: "Customer-support communications",
        retention: (
            <>
                Up to 7 years from last contact, in case of dispute or complaint
            </>
        ),
    },
    {
        type: "Marketing preferences and opt-ins",
        retention: (
            <>
                Until you opt out or request deletion; a suppression record is
                retained indefinitely to prevent future contact
            </>
        ),
    },
    {
        type: "Reviews, surveys, and product feedback (including any sensitive content you submit)",
        retention: (
            <>
                <strong>De-identified within 24 months</strong> of submission
                and retained in aggregated, non-identifiable form for product,
                clinical-quality, and service-improvement analysis. Identifiable
                reviews used with attribution on the Site are retained while
                displayed and for 24 months after removal.
            </>
        ),
    },
    {
        type: "Privacy-rights requests and verification records",
        retention: <>As long as necessary to comply with applicable law</>,
    },
    {
        type: "Security and audit logs",
        retention: (
            <>
                As long as necessary to comply with applicable law and to
                maintain information security
            </>
        ),
    },
    {
        type: "HIPAA-governed records (PHI, BAA records, breach records)",
        retention: (
            <>
                For the period required by federal and state law (generally at
                least 6 years from creation or last effective date for HIPAA
                records; longer where state medical or pharmacy record-retention
                rules require)
            </>
        ),
    },
]

export default function RetentionTable(props) {
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
                        {/* Type of data — acts as the heading, no label */}
                        <p
                            style={{
                                ...value,
                                ...headingFont,
                                color: textColor,
                                fontWeight: 700,
                            }}
                        >
                            {row.type}
                        </p>

                        <div>
                            <div style={label}>{HEADERS.retention}</div>
                            <p style={value}>{row.retention}</p>
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
                    <col style={{ width: "40%" }} />
                    <col style={{ width: "60%" }} />
                </colgroup>
                <thead>
                    <tr>
                        <th style={th}>{HEADERS.type}</th>
                        <th style={th}>{HEADERS.retention}</th>
                    </tr>
                </thead>
                <tbody>
                    {ROWS.map((row, i) => (
                        <tr key={i}>
                            <td style={td}>{row.type}</td>
                            <td style={td}>{row.retention}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

RetentionTable.defaultProps = {
    textColor: "#331110",
    mutedColor: "#8A7268",
    borderColor: "#DBD4BD",
    headerBackground: "rgba(0,0,0,0)",
    cellPadding: 16,
}

addPropertyControls(RetentionTable, {
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
