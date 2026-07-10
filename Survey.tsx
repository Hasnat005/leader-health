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
    const [iframeHeight, setIframeHeight] = useState<number>(600)

    // Listen for auto-resize messages from the Wizlo iframe
    useEffect(() => {
        function handleMessage(event: MessageEvent) {
            if (!event.data) return
            if (event.data.type === "wizlo-form-resize") {
                setIframeHeight(event.data.height)
            }
        }
        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [])

    if (!wizloFormId) {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "40px",
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
                width: "100%",
                border: "none",
                height: iframeHeight,
                display: "block",
                ...style,
            }}
            scrolling="no"
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
