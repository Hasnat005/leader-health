import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * PrivacyTable — "Category / Purpose / Sold or shared? / Retention period"
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
    category: "Category of personal information collected",
    purpose: "Purpose",
    sold: "Sold or shared?",
    retention: "Retention period",
}

const ROWS = [
    {
        category: "Identifiers (name, email, address, phone, DOB)",
        purpose:
            "Account creation; communication; identity verification; coordinate care",
        sold: "No",
        retention: "While account active + 7 years after closure",
    },
    {
        category:
            "Health information (intake, conditions, medications, allergies, photos when uploaded)",
        purpose: "Coordinate clinical care; deliver Service",
        sold: "No",
        retention:
            "Per the Affiliated Provider Network's medical-record retention applicable to the state in which care was provided (minimum periods vary by state — for example, 7 years for adults under Texas law and longer for minors and in some other states; the longer of the applicable state minimum and any federal minimum applies)",
    },
    {
        category: "Internet/network activity (cookies, device, IP, browsing)",
        purpose: "Operate the Site; security; analytics",
        sold: "No (except essential and analytics cookies as disclosed in Cookies & Tracking)",
        retention: "Up to 13 months",
    },
    {
        category: "Geolocation (approximate, from IP)",
        purpose: "Determine state availability and route care",
        sold: "No",
        retention: "Up to 13 months",
    },
    {
        category: "Inferences",
        purpose: "Personalize the Site and Service",
        sold: "No",
        retention: "Up to 24 months",
    },
    {
        category:
            "Sensitive personal information (HIPAA-protected health information, government identifiers if you choose to upload them)",
        purpose: "Coordinate clinical care; identity verification",
        sold: "No",
        retention: "Per medical-record retention rules above",
    },
]

export default function PrivacyTable(props) {
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
                            <div style={label}>{HEADERS.purpose}</div>
                            <p style={value}>{row.purpose}</p>
                        </div>

                        <div>
                            <div style={label}>{HEADERS.sold}</div>
                            <p style={value}>{row.sold}</p>
                        </div>

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
                    <col style={{ width: "24%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "38%" }} />
                </colgroup>
                <thead>
                    <tr>
                        <th style={th}>{HEADERS.category}</th>
                        <th style={th}>{HEADERS.purpose}</th>
                        <th style={th}>{HEADERS.sold}</th>
                        <th style={th}>{HEADERS.retention}</th>
                    </tr>
                </thead>
                <tbody>
                    {ROWS.map((row, i) => (
                        <tr key={i}>
                            <td style={td}>{row.category}</td>
                            <td style={td}>{row.purpose}</td>
                            <td style={td}>{row.sold}</td>
                            <td style={td}>{row.retention}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

PrivacyTable.defaultProps = {
    textColor: "#331110",
    mutedColor: "#8A7268",
    borderColor: "#DBD4BD",
    headerBackground: "rgba(0,0,0,0)",
    cellPadding: 16,
}

addPropertyControls(PrivacyTable, {
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
