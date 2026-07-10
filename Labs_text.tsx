import { addPropertyControls, ControlType } from "framer"
import { useState } from "react"

export default function ReadMore({
    text,
    previewLength,
    fontSize,
    fontFamily,
    color,
    linkColor,
}) {
    const [expanded, setExpanded] = useState(false)

    const shouldTruncate = text?.length > (previewLength || 150)
    const displayText =
        expanded || !shouldTruncate
            ? text
            : text?.slice(0, previewLength || 150) + "…"

    return (
        <p
            style={{
                fontSize: fontSize || 14,
                fontFamily: fontFamily || "geist",
                color: color || "#000",
                lineHeight: 1.6,
                margin: 0,
                textAlign: "justify",
            }}
        >
            {displayText}{" "}
            {shouldTruncate && (
                <span
                    onClick={() => setExpanded(!expanded)}
                    style={{
                        color: linkColor || "#331110",
                        cursor: "pointer",
                        fontWeight: 500,
                        textDecoration: "underline",
                    }}
                >
                    {expanded ? "Read less" : "Read more"}
                </span>
            )}
        </p>
    )
}

addPropertyControls(ReadMore, {
    text: {
        type: ControlType.String,
        title: "Text",
        displayTextArea: true,
        defaultValue: "Your long text goes here...",
    },
    previewLength: {
        type: ControlType.Number,
        title: "Preview Length",
        defaultValue: 150,
        min: 50,
        max: 500,
    },
    fontSize: {
        type: ControlType.Number,
        title: "Font Size",
        defaultValue: 14,
    },
    color: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#000000",
    },
    linkColor: {
        type: ControlType.Color,
        title: "Link Color",
        defaultValue: "#331110",
    },
    fontFamily: {
        type: ControlType.String,
        title: "Font Family",
        defaultValue: "inherit",
    },
})
