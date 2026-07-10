import { addPropertyControls, ControlType } from "framer"

/**
 * Homepage section — local dev workflow with GitHub Link sync for Framer.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 720
 */

type Step = {
    number: string
    title: string
    description: string
    code?: string
    accent?: string
}

const DEFAULT_STEPS: Step[] = [
    {
        number: "01",
        title: "Clone & code locally",
        description:
            "Pull the repo to your machine and edit Code Components in your IDE. This folder holds .tsx files synced from Framer — not a standalone npm app.",
        code: "git clone https://github.com/Hasnat005/leader-health.git\ncd leader-health\ngit pull origin main",
        accent: "#331110",
    },
    {
        number: "02",
        title: "Push to GitHub",
        description:
            "Commit and push your changes so the remote stays the source of truth for your team.",
        code: "git add .\ngit commit -m \"Update components\"\ngit push origin main",
        accent: "#1a1a1a",
    },
    {
        number: "03",
        title: "Pull in Framer",
        description:
            "Open your Framer project → GitHub Link plugin → select changed files → Pull from GitHub. Framer does not auto-sync; you must pull after every GitHub push.",
        accent: "#2563eb",
    },
    {
        number: "04",
        title: "Preview",
        description:
            "Click the Play button in Framer to preview interactively, or open your published .framer.website URL in an incognito window to verify production behavior.",
        accent: "#059669",
    },
    {
        number: "05",
        title: "Publish live",
        description:
            "When preview looks correct, click Publish. Only published changes appear on your live domain. Code changes alone are not live until you publish.",
        accent: "#7c3aed",
    },
]

type Props = {
    eyebrow: string
    title: string
    subtitle: string
    repoUrl: string
    repoLabel: string
    background: string
    cardBackground: string
    textColor: string
    mutedColor: string
    borderColor: string
    maxWidth: number
    paddingY: number
    paddingX: number
}

export default function DevWorkflowSection(props: Partial<Props>) {
    const {
        eyebrow = "Developer Workflow",
        title = "Code locally. Sync with Framer. Ship with confidence.",
        subtitle =
            "This project uses GitHub Link for two-way sync of Code Components. Follow the workflow below to edit in your IDE, preview in Framer, and publish to production.",
        repoUrl = "https://github.com/Hasnat005/leader-health",
        repoLabel = "Hasnat005/leader-health",
        background = "#f9f9f9",
        cardBackground = "#ffffff",
        textColor = "#0f172a",
        mutedColor = "#64748b",
        borderColor = "#e2e8f0",
        maxWidth = 1120,
        paddingY = 96,
        paddingX = 32,
    } = props

    return (
        <section
            style={{
                width: "100%",
                background,
                padding: `${paddingY}px ${paddingX}px`,
                boxSizing: "border-box",
                fontFamily:
                    '"Geist", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
        >
            <div
                style={{
                    maxWidth,
                    margin: "0 auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 48,
                }}
            >
                <header style={{ maxWidth: 720 }}>
                    <p
                        style={{
                            margin: "0 0 12px",
                            fontSize: 13,
                            fontWeight: 600,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: mutedColor,
                        }}
                    >
                        {eyebrow}
                    </p>
                    <h2
                        style={{
                            margin: "0 0 16px",
                            fontSize: "clamp(28px, 4vw, 40px)",
                            fontWeight: 600,
                            lineHeight: 1.15,
                            letterSpacing: "-0.02em",
                            color: textColor,
                        }}
                    >
                        {title}
                    </h2>
                    <p
                        style={{
                            margin: 0,
                            fontSize: 17,
                            lineHeight: 1.65,
                            color: mutedColor,
                        }}
                    >
                        {subtitle}
                    </p>
                </header>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                        gap: 20,
                    }}
                >
                    {DEFAULT_STEPS.map((step) => (
                        <article
                            key={step.number}
                            style={{
                                background: cardBackground,
                                border: `1px solid ${borderColor}`,
                                borderRadius: 16,
                                padding: "28px 24px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 14,
                                boxShadow:
                                    "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.04)",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                }}
                            >
                                <span
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 36,
                                        height: 36,
                                        borderRadius: 10,
                                        background:
                                            step.accent + "14",
                                        color: step.accent,
                                        fontSize: 13,
                                        fontWeight: 700,
                                        flexShrink: 0,
                                    }}
                                >
                                    {step.number}
                                </span>
                                <h3
                                    style={{
                                        margin: 0,
                                        fontSize: 18,
                                        fontWeight: 600,
                                        lineHeight: 1.3,
                                        color: textColor,
                                    }}
                                >
                                    {step.title}
                                </h3>
                            </div>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 15,
                                    lineHeight: 1.6,
                                    color: mutedColor,
                                }}
                            >
                                {step.description}
                            </p>
                            {step.code && (
                                <pre
                                    style={{
                                        margin: 0,
                                        padding: "14px 16px",
                                        borderRadius: 10,
                                        background: "#0f172a",
                                        color: "#e2e8f0",
                                        fontSize: 12.5,
                                        lineHeight: 1.55,
                                        overflowX: "auto",
                                        fontFamily:
                                            '"Fragment Mono", "SF Mono", Consolas, monospace',
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                    }}
                                >
                                    {step.code}
                                </pre>
                            )}
                        </article>
                    ))}
                </div>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 20,
                        padding: "24px 28px",
                        borderRadius: 16,
                        border: `1px solid ${borderColor}`,
                        background: cardBackground,
                    }}
                >
                    <div>
                        <p
                            style={{
                                margin: "0 0 6px",
                                fontSize: 14,
                                fontWeight: 600,
                                color: textColor,
                            }}
                        >
                            Quick reference
                        </p>
                        <p
                            style={{
                                margin: 0,
                                fontSize: 14,
                                lineHeight: 1.55,
                                color: mutedColor,
                            }}
                        >
                            GitHub ↔ Framer sync is manual. Push from Framer to
                            backup code; Pull from GitHub after local edits.
                            Layout and CMS are not in the repo.
                        </p>
                    </div>
                    <a
                        href={repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "12px 20px",
                            borderRadius: 999,
                            background: textColor,
                            color: "#ffffff",
                            fontSize: 14,
                            fontWeight: 600,
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                            transition: "opacity 0.15s ease",
                        }}
                    >
                        <GitHubIcon />
                        {repoLabel}
                    </a>
                </div>

                <FlowDiagram mutedColor={mutedColor} borderColor={borderColor} />
            </div>
        </section>
    )
}

function GitHubIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.18.82.63-.18 1.31-.27 1.98-.27.67 0 1.35.09 1.98.27 1.51-1.04 2.18-.82 2.18-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
    )
}

function FlowDiagram({
    mutedColor,
    borderColor,
}: {
    mutedColor: string
    borderColor: string
}) {
    const nodes = [
        "Local IDE",
        "GitHub",
        "Framer Pull",
        "Preview",
        "Publish",
    ]

    return (
        <div
            style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "20px 16px",
            }}
            aria-label="Workflow: Local IDE to GitHub to Framer Pull to Preview to Publish"
        >
            {nodes.map((label, i) => (
                <div
                    key={label}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                    <span
                        style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            border: `1px solid ${borderColor}`,
                            background: "#fff",
                            fontSize: 13,
                            fontWeight: 500,
                            color: mutedColor,
                        }}
                    >
                        {label}
                    </span>
                    {i < nodes.length - 1 && (
                        <span
                            style={{
                                color: mutedColor,
                                fontSize: 16,
                                userSelect: "none",
                            }}
                            aria-hidden
                        >
                            →
                        </span>
                    )}
                </div>
            ))}
        </div>
    )
}

addPropertyControls(DevWorkflowSection, {
    eyebrow: {
        type: ControlType.String,
        title: "Eyebrow",
        defaultValue: "Developer Workflow",
    },
    title: {
        type: ControlType.String,
        title: "Title",
        defaultValue: "Code locally. Sync with Framer. Ship with confidence.",
    },
    subtitle: {
        type: ControlType.String,
        title: "Subtitle",
        displayTextArea: true,
        defaultValue:
            "This project uses GitHub Link for two-way sync of Code Components. Follow the workflow below to edit in your IDE, preview in Framer, and publish to production.",
    },
    repoUrl: {
        type: ControlType.String,
        title: "Repo URL",
        defaultValue: "https://github.com/Hasnat005/leader-health",
    },
    repoLabel: {
        type: ControlType.String,
        title: "Repo Label",
        defaultValue: "Hasnat005/leader-health",
    },
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#f9f9f9",
    },
    cardBackground: {
        type: ControlType.Color,
        title: "Card BG",
        defaultValue: "#ffffff",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text",
        defaultValue: "#0f172a",
    },
    mutedColor: {
        type: ControlType.Color,
        title: "Muted Text",
        defaultValue: "#64748b",
    },
    borderColor: {
        type: ControlType.Color,
        title: "Border",
        defaultValue: "#e2e8f0",
    },
    maxWidth: {
        type: ControlType.Number,
        title: "Max Width",
        defaultValue: 1120,
        min: 640,
        max: 1400,
    },
    paddingY: {
        type: ControlType.Number,
        title: "Padding Y",
        defaultValue: 96,
        min: 32,
        max: 160,
    },
    paddingX: {
        type: ControlType.Number,
        title: "Padding X",
        defaultValue: 32,
        min: 16,
        max: 80,
    },
})
