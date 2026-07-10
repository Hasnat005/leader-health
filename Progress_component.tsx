import { addPropertyControls, ControlType } from "framer"
import { useEffect, useState } from "react"

/**
 * STAT RING
 * Animated circular progress ring with a big percentage and caption.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 280
 * @framerIntrinsicHeight 340
 */
export default function StatRing(props) {
    const {
        percent,
        caption,
        size,
        thickness,
        roundCap,
        trackColor,
        progressColor,
        numberColor,
        percentColor,
        captionColor,
        numberFont,
        captionFont,
        showPercentSign,
        captionGap,
        animate,
        duration,
    } = props

    const radius = (size - thickness) / 2
    const circumference = 2 * Math.PI * radius
    const target = Math.max(0, Math.min(100, percent))

    const [progress, setProgress] = useState(animate ? 0 : target)

    useEffect(() => {
        if (!animate) {
            setProgress(target)
            return
        }
        let raf
        const start = performance.now()
        const tick = (now) => {
            const t = Math.min(1, (now - start) / (duration * 1000))
            const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
            setProgress(target * eased)
            if (t < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [target, animate, duration])

    const offset = circumference * (1 - progress / 100)

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: captionGap,
                background: "transparent",
                width: "100%",
                height: "100%",
            }}
        >
            <div
                style={{
                    position: "relative",
                    width: size,
                    height: size,
                    flexShrink: 0,
                }}
            >
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    style={{ transform: "rotate(-90deg)" }}
                >
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={trackColor}
                        strokeWidth={thickness}
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={progressColor}
                        strokeWidth={thickness}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap={roundCap ? "round" : "butt"}
                    />
                </svg>

                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <span
                        style={{
                            ...numberFont,
                            color: numberColor,
                            lineHeight: 1,
                            display: "inline-flex",
                            alignItems: "flex-start",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {Math.round(progress)}
                        {showPercentSign && (
                            <span
                                style={{
                                    color: percentColor,
                                    fontSize: "0.42em",
                                    marginTop: "0.22em",
                                    marginLeft: "0.04em",
                                }}
                            >
                                %
                            </span>
                        )}
                    </span>
                </div>
            </div>

            {caption ? (
                <div
                    style={{
                        ...captionFont,
                        color: captionColor,
                        textAlign: "center",
                        maxWidth: size * 1.4,
                    }}
                >
                    {caption}
                </div>
            ) : null}
        </div>
    )
}

StatRing.defaultProps = {
    percent: 53,
    caption: "saw increased energy levels",
    size: 280,
    thickness: 4,
    roundCap: false,
    trackColor: "#DBD4BD",
    progressColor: "#E33D4D",
    numberColor: "#331110",
    percentColor: "#331110",
    captionColor: "#8A7F7A",
    showPercentSign: true,
    captionGap: 28,
    animate: true,
    duration: 1.4,
}

addPropertyControls(StatRing, {
    percent: {
        type: ControlType.Number,
        title: "Percent",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        displayStepper: true,
    },
    caption: {
        type: ControlType.String,
        title: "Caption",
        displayTextArea: true,
    },
    size: {
        type: ControlType.Number,
        title: "Size",
        min: 80,
        max: 800,
        step: 1,
        unit: "px",
    },
    thickness: {
        type: ControlType.Number,
        title: "Stroke",
        min: 1,
        max: 60,
        step: 1,
        unit: "px",
    },
    roundCap: {
        type: ControlType.Boolean,
        title: "Round ends",
        enabledTitle: "Round",
        disabledTitle: "Flat",
    },
    trackColor: {
        type: ControlType.Color,
        title: "Track",
    },
    progressColor: {
        type: ControlType.Color,
        title: "Progress",
    },
    numberColor: {
        type: ControlType.Color,
        title: "Number",
    },
    showPercentSign: {
        type: ControlType.Boolean,
        title: "Show %",
        defaultValue: true,
    },
    percentColor: {
        type: ControlType.Color,
        title: "% Color",
        hidden: (props) => !props.showPercentSign,
    },
    captionColor: {
        type: ControlType.Color,
        title: "Caption",
    },
    numberFont: {
        type: ControlType.Font,
        title: "Number font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontFamily: "Inter",
            fontSize: 96,
            fontWeight: 600,
            letterSpacing: "-0.02em",
        },
    },
    captionFont: {
        type: ControlType.Font,
        title: "Caption font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontFamily: "Inter",
            fontSize: 17,
            fontWeight: 500,
            letterSpacing: "0em",
        },
    },
    captionGap: {
        type: ControlType.Number,
        title: "Caption gap",
        min: 0,
        max: 120,
        step: 1,
        unit: "px",
    },
    animate: {
        type: ControlType.Boolean,
        title: "Animate",
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    duration: {
        type: ControlType.Number,
        title: "Duration",
        min: 0.2,
        max: 5,
        step: 0.1,
        unit: "s",
        hidden: (props) => !props.animate,
    },
})
