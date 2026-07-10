import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * DisclosureTable — Terms "Party / What they do / Independent? / Notes"
 *
 * • Desktop / tablet (≥768px): normal HTML <table>
 * • Mobile (<768px): same table styling, stacked vertically —
 *   each party is a section divided by the same hairline rules,
 *   with the column names as plain labels. No cards, no badges.
 * • Fonts and colors editable in the property panel
 * • Legal copy lives in the ROWS constant below (bold preserved)
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1100
 */

const ROWS = [
    {
        party: "Leader Health",
        partySub: "(LH Ventures LLC dba Leader Health)",
        independent: null, // renders as —
        what: (
            <>
                Operates the Site and Platform as the MSO and technology /
                administrative-services company. Provides technology,
                scheduling, customer service, education, billing operations, and
                administrative services.{" "}
                <strong>
                    Uses the "Leader Health" name and marks under license from
                    Leader Health LLC.
                </strong>
            </>
        ),
        notes: (
            <>
                <strong>Leader Health does not practice medicine</strong> and
                does not provide medical advice, diagnosis, or treatment.
                Medical oversight of the platform program (a non-treatment,
                program-level function — for example, protocol design, quality
                review, and platform safety) is provided to Leader Health by{" "}
                <strong>Ratcliff Health PLLC</strong> under a Physician Services
                Agreement; Ratcliff Health PLLC does <strong>not</strong> treat
                platform patients and does <strong>not</strong> direct your
                Provider's individual clinical decisions about you.
            </>
        ),
    },
    {
        party: "Affiliated Provider Network",
        partySub: null,
        independent: true,
        what: (
            <>
                Independent licensed clinicians and the professional medical
                entity through which they practice. Performs telehealth visits,
                reviews labs, writes prescriptions, and manages clinical care.
                Exercises its own clinical governance; the Network's clinicians
                exercise independent clinical judgment.
            </>
        ),
        notes: (
            <>
                Each Provider is licensed in the state where you are physically
                located at the time of the encounter. The identity and licensure
                of the clinician treating you, and the current Affiliated
                Provider Network, are disclosed to you in the patient dashboard
                and at the visit. Leader Health does not employ Providers, does
                not control their independent professional judgment, and does
                not receive any portion of professional fees for the practice of
                medicine.{" "}
                <strong>
                    Leader Health may add to, expand, or substitute the
                    Affiliated Provider Network on notice to you without
                    revising these Terms.
                </strong>
            </>
        ),
    },
    {
        party: "Pharmacies",
        partySub: null,
        independent: true,
        what: (
            <>
                Independent licensed pharmacies — including compounding
                pharmacies — that dispense and ship prescriptions written by a
                Provider.
            </>
        ),
        notes: (
            <>
                Your prescription may be transferred between Pharmacies as
                needed to deliver your care, and you authorize Leader Health to
                arrange that on your behalf.
            </>
        ),
    },
    {
        party: "Lab",
        partySub: null,
        independent: true,
        what: (
            <>
                An independent reference laboratory that performs diagnostic
                testing ordered by a Provider.
            </>
        ),
        notes: (
            <>
                Quest Diagnostics is our exclusive laboratory partner; we may
                add or substitute partner laboratories on notice.
            </>
        ),
    },
]

export default function DisclosureTable(props) {
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
    const [width, setWidth] = useState(1100)

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
                        {/* Party */}
                        <div>
                            <div style={label}>Party</div>
                            <p style={{ ...value, fontWeight: 700 }}>
                                {row.party}
                            </p>
                            {row.partySub && (
                                <p
                                    style={{
                                        ...value,
                                        color: mutedColor,
                                        fontSize: 13,
                                        marginTop: 2,
                                    }}
                                >
                                    {row.partySub}
                                </p>
                            )}
                        </div>

                        {/* What they do */}
                        <div>
                            <div style={label}>What they do</div>
                            <p style={value}>{row.what}</p>
                        </div>

                        {/* Independent? */}
                        <div>
                            <div style={label}>Independent?</div>
                            <p style={value}>{row.independent ? "Yes" : "—"}</p>
                        </div>

                        {/* Notes */}
                        <div>
                            <div style={label}>Notes</div>
                            <p style={value}>{row.notes}</p>
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
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "43%" }} />
                </colgroup>
                <thead>
                    <tr>
                        <th style={th}>Party</th>
                        <th style={th}>What they do</th>
                        <th style={{ ...th, textAlign: "center" }}>
                            Independent?
                        </th>
                        <th style={th}>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {ROWS.map((row, i) => (
                        <tr key={i}>
                            <td style={{ ...td, fontWeight: 700 }}>
                                {row.party}
                                {row.partySub && (
                                    <div
                                        style={{
                                            ...bodyFont,
                                            color: mutedColor,
                                            fontWeight: 400,
                                            fontSize: 13,
                                            marginTop: 2,
                                        }}
                                    >
                                        {row.partySub}
                                    </div>
                                )}
                            </td>
                            <td style={td}>{row.what}</td>
                            <td style={{ ...td, textAlign: "center" }}>
                                {row.independent ? "Yes" : "—"}
                            </td>
                            <td style={td}>{row.notes}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

DisclosureTable.defaultProps = {
    textColor: "#331110",
    mutedColor: "#8A7268",
    borderColor: "#DBD4BD",
    headerBackground: "rgba(0,0,0,0)",
    cellPadding: 16,
}

addPropertyControls(DisclosureTable, {
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
