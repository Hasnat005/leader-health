import { useEffect, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

// ─── Config ───────────────────────────────────────────────────────────────────
const WIZLO_FORM_BASE = "https://app.wizlo.com/form-submission"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
    wizloFormId?: string
    style?: React.CSSProperties
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function WizloSurvey({ wizloFormId, style }: Props) {
    const [viewportHeight, setViewportHeight] = useState<number>(
        typeof window !== "undefined" ? window.innerHeight : 600
    )

    // Track the browser window's height so the iframe always fills it
    useEffect(() => {
        function handleResize() {
            setViewportHeight(window.innerHeight)
        }
        window.addEventListener("resize", handleResize)
        // Set initial value in case it changed before mount
        handleResize()
        return () => window.removeEventListener("resize", handleResize)
    }, [])

    if (!wizloFormId) {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100vw",
                    height: "100vh",
                    color: "#888",
                    fontSize: "14px",
                    ...style,
                }}
            >
                No Wizlo Form ID set. Add one in the CMS or property panel.
            </div>
        )
    }

    return (
        <iframe
            src={`${WIZLO_FORM_BASE}?token=${wizloFormId}`}
            style={{
                width: "100vw",
                height: `${viewportHeight}px`,
                border: "none",
                display: "block",
                margin: 0,
                padding: 0,
                ...style,
            }}
            scrolling="auto"
        />
    )
}

// ─── Property Controls ────────────────────────────────────────────────────────
addPropertyControls(WizloSurvey, {
    wizloFormId: {
        type: ControlType.String,
        title: "Wizlo Form ID",
        placeholder: "Paste UUID from Wizlo dashboard",
    },
})
