// Button with loading + confetti + subtle hover animation that fills the entire button

import { useState, useEffect, startTransition, type CSSProperties } from "react"
import { addPropertyControls, ControlType } from "framer"
import { motion, AnimatePresence } from "framer-motion"
import type React from "react"

interface LoadingButtonProps {
    label: string
    loadingDuration: number
    resetDelay: number
    backgroundColor: string
    hoverColor: string
    textColor: string
    buttonFont: any
    borderRadius: number
    confettiColors: string[]
    strokeWidth: number
    strokeColor: string
    doneText: string
    doneTextColor: string
    buttonType: "submit" | "button"
    style?: CSSProperties
}

/**
 * @framerIntrinsicWidth 127
 * @framerIntrinsicHeight 40
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */

export default function LoadingButton(props: LoadingButtonProps) {
    const {
        label,
        loadingDuration,
        resetDelay,
        backgroundColor,
        hoverColor,
        textColor,
        buttonFont,
        borderRadius,
        confettiColors,
        strokeWidth,
        strokeColor,
        doneText,
        doneTextColor,
        buttonType,
    } = props

    const [state, setState] = useState<
        "idle" | "loading" | "drop" | "confetti" | "done"
    >("idle")

    const [isHover, setIsHover] = useState(false)
    const [confetti, setConfetti] = useState<any[]>([])

    useEffect(() => {
        if (state === "loading") {
            const timer = setTimeout(() => {
                startTransition(() => setState("drop"))
            }, loadingDuration * 1000)

            return () => clearTimeout(timer)
        }

        if (state === "drop") {
            const timer = setTimeout(() => {
                startTransition(() => {
                    setState("confetti")

                    const particles = Array.from({ length: 36 }, (_, i) => {
                        const angle =
                            -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9
                        const distance = 100 + Math.random() * 110

                        return {
                            id: i,
                            delay: Math.random() * 0.06,
                            baseSize: 6 + Math.random() * 6,
                            rotation: 360 + Math.random() * 720,
                            color: confettiColors[
                                Math.floor(
                                    Math.random() * confettiColors.length
                                )
                            ],
                            x: Math.cos(angle) * distance,
                            y: Math.sin(angle) * distance,
                            widthFactor: 0.6 + Math.random() * 1.4,
                            heightFactor: 0.4 + Math.random() * 1.2,
                            radius:
                                Math.random() > 0.7
                                    ? "50%"
                                    : `${Math.random() * 3}px`,
                            startRotate: Math.random() * 360,
                        }
                    })

                    setConfetti(particles)
                })
            }, 250)

            return () => clearTimeout(timer)
        }

        if (state === "confetti") {
            const timer = setTimeout(() => {
                startTransition(() => setState("done"))
            }, 1600)

            return () => clearTimeout(timer)
        }

        if (state === "done") {
            const timer = setTimeout(() => {
                startTransition(() => {
                    setState("idle")
                    setConfetti([])
                })
            }, resetDelay * 1000)

            return () => clearTimeout(timer)
        }
    }, [state])

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (state === "idle") {
            // If button type is submit, check form validity
            if (buttonType === "submit") {
                const button = e.currentTarget
                const form = button.form

                // If there's a form and it's invalid, don't trigger animation
                if (form && !form.checkValidity()) {
                    return
                }
            }

            startTransition(() => setState("loading"))
        }
    }

    return (
        <div
            style={{
                position: "relative",
                display: "inline-block",
                width: "100%",
                height: "100%",
            }}
        >
            <motion.button
                type={buttonType}
                onClick={handleClick}
                disabled={state === "loading"}
                onHoverStart={() => setIsHover(true)}
                onHoverEnd={() => setIsHover(false)}
                style={{
                    ...props.style,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "12px 24px",
                    backgroundColor,
                    color: textColor,
                    border: `${strokeWidth}px solid ${strokeColor}`,
                    borderRadius,
                    cursor: "pointer",
                    overflow: "hidden",
                    position: "relative",
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "manipulation",
                    ...buttonFont,
                }}
            >
                {/* Full button hover glow */}
                <motion.div
                    initial={{ x: "-100%" }}
                    animate={{
                        x: isHover ? "100%" : "-100%",
                    }}
                    transition={{
                        duration: isHover ? 0.6 : 0,
                        ease: "easeInOut",
                    }}
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: `linear-gradient(90deg, transparent 0%, ${hoverColor} 50%, transparent 100%)`,
                        borderRadius,
                        zIndex: 0,
                        pointerEvents: "none",
                        opacity: 0.4,
                    }}
                />

                <span
                    style={{
                        position: "relative",
                        zIndex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {state === "idle" && label}

                    {(state === "loading" || state === "drop") && (
                        <span
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 4,
                            }}
                        >
                            {[0, 1, 2].map((i) => (
                                <motion.span
                                    key={i}
                                    animate={
                                        state === "loading"
                                            ? { opacity: [0.3, 1, 0.3] }
                                            : { y: 14, opacity: 0 }
                                    }
                                    transition={
                                        state === "loading"
                                            ? {
                                                  duration: 1,
                                                  repeat: Infinity,
                                                  delay: i * 0.2,
                                              }
                                            : {
                                                  duration: 0.25,
                                                  ease: "easeIn",
                                              }
                                    }
                                >
                                    •
                                </motion.span>
                            ))}
                        </span>
                    )}

                    {(state === "confetti" || state === "done") && (
                        <span style={{ color: doneTextColor }}>{doneText}</span>
                    )}
                </span>
            </motion.button>

            <AnimatePresence>
                {state === "confetti" &&
                    confetti.map((p) => (
                        <motion.div
                            key={p.id}
                            initial={{
                                position: "absolute",
                                bottom: 0,
                                left: "50%",
                                width: p.baseSize * p.widthFactor,
                                height: p.baseSize * p.heightFactor,
                                backgroundColor: p.color,
                                borderRadius: p.radius,
                                opacity: 1,
                                rotate: p.startRotate,
                                translateX: "-50%",
                            }}
                            animate={{
                                x: p.x,
                                y: p.y,
                                rotate: p.rotation,
                                opacity: [1, 1, 0],
                            }}
                            transition={{
                                duration: 1.4,
                                delay: p.delay,
                                ease: [0.2, 0.9, 0.2, 1],
                            }}
                            style={{ pointerEvents: "none" }}
                        />
                    ))}
            </AnimatePresence>
        </div>
    )
}

addPropertyControls(LoadingButton, {
    label: {
        type: ControlType.String,
        title: "Label",
        defaultValue: "Join Waitlist",
    },
    doneText: {
        type: ControlType.String,
        title: "Done Text",
        defaultValue: "You're In!",
    },

    loadingDuration: {
        type: ControlType.Number,
        title: "Loading",
        defaultValue: 2,
        min: 0.5,
        max: 10,
        step: 0.5,
        unit: "s",
    },

    resetDelay: {
        type: ControlType.Number,
        title: "Reset After",
        defaultValue: 0.5,
        min: 0.1,
        max: 10,
        step: 0.5,
        unit: "s",
    },

    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000",
    },

    hoverColor: {
        type: ControlType.Color,
        title: "Hover Color",
        defaultValue: "rgba(0, 143, 12, 0.86)",
    },

    textColor: {
        type: ControlType.Color,
        title: "Text",
        defaultValue: "#fff",
    },

    confettiColors: {
        type: ControlType.Array,
        title: "Confetti Colors",
        control: { type: ControlType.Color },
        defaultValue: ["#000", "#00FF11", "#000", "#00FF11", "#000", "#00FF11"],
    },

    buttonFont: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: "10px",
            variant: "Regular",
        },
    },

    borderRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 50,
        min: 0,
        max: 50,
        unit: "px",
    },
    strokeWidth: {
        type: ControlType.Number,
        title: "Stroke Width",
        defaultValue: 0.5,
        min: 0,
        max: 10,
        step: 0.1,
        unit: "px",
    },
    strokeColor: {
        type: ControlType.Color,
        title: "Stroke Color",
        defaultValue: "#828282",
    },
    doneTextColor: {
        type: ControlType.Color,
        title: "Done Text Color",
        defaultValue: "#00FF11",
    },
    buttonType: {
        type: ControlType.Enum,
        title: "Button Type",
        options: ["submit", "button"],
        optionTitles: ["Submit", "Button"],
        defaultValue: "submit",
        displaySegmentedControl: true,
    },
})
