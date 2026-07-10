// CMSPhotoGallery.tsx — Framer Code Component
// Bind the "Images" prop directly to your CMS Gallery field
// using the pink field-binding pin (◈) in the Properties panel.

import { addPropertyControls, ControlType, RenderTarget } from "framer"
import { useState, useEffect, useRef, useCallback } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

// Framer passes each Gallery field item as { src, srcSet, alt }
interface CMSImage {
    src: string
    srcSet?: string
    alt?: string
}

type AspectRatio = "1:1" | "4:3" | "16:9" | "3:4" | "9:16"
type ImageFit = "cover" | "contain"

interface Props {
    // ◈ Bind this to your CMS Gallery field via the pin connector
    images?: CMSImage[]
    zoomDuration?: number
    fadeDuration?: number
    aspectRatio?: AspectRatio
    imageFit?: ImageFit
    cornerRadius?: number
    gap?: number
    thumbRadius?: number
    thumbWidth?: number
    thumbHeight?: number
    activeColor?: string
    activeBorder?: number
    background?: string
    arrowBackground?: string
    arrowColor?: string
    autoPlay?: boolean
    autoPlayInterval?: number
}

// ─── Aspect ratio map ─────────────────────────────────────────────────────────

const RATIO_MAP: Record<AspectRatio, number> = {
    "1:1": 1,
    "4:3": 4 / 3,
    "16:9": 16 / 9,
    "3:4": 3 / 4,
    "9:16": 9 / 16,
}

// ─── Arrow ────────────────────────────────────────────────────────────────────

function Arrow({ dir, color }: { dir: "left" | "right"; color: string }) {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            style={{ transform: dir === "left" ? "rotate(180deg)" : "none" }}
        >
            <path
                d="M9 18l6-6-6-6"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ bg, radius }: { bg: string; radius: number }) {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                minHeight: 240,
                borderRadius: radius,
                background: bg,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontFamily: "Inter,sans-serif",
                userSelect: "none",
                border: "1.5px dashed rgba(150,150,150,0.35)",
                boxSizing: "border-box",
            }}
        >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="3"
                    stroke="rgba(150,150,150,0.7)"
                    strokeWidth="1.5"
                />
                <circle
                    cx="8.5"
                    cy="8.5"
                    r="1.5"
                    fill="rgba(150,150,150,0.7)"
                />
                <path
                    d="M3 16l5-5 4 4 3-3 6 6"
                    stroke="rgba(150,150,150,0.7)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            <p
                style={{
                    color: "rgba(120,120,120,0.9)",
                    fontSize: 12,
                    fontWeight: 600,
                    margin: "0 0 2px",
                    fontFamily: "Inter,sans-serif",
                }}
            >
                CMS Photo Gallery
            </p>
            <p
                style={{
                    color: "rgba(120,120,120,0.55)",
                    fontSize: 11,
                    margin: 0,
                    lineHeight: 1.5,
                    textAlign: "center",
                }}
            >
                Click ◈ next to <strong>Images</strong>
                <br />
                to connect your Gallery field
            </p>
        </div>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CMSPhotoGallery({
    images = [],
    zoomDuration = 0,
    fadeDuration = 0.7,
    aspectRatio = "1:1",
    imageFit = "cover",
    cornerRadius = 20,
    gap = 4,
    thumbRadius = 9,
    thumbWidth = 200,
    thumbHeight = 120,
    activeColor = "#FFFFFF",
    activeBorder = 3,
    background = "#F9F9F9",
    arrowBackground = "#000000",
    arrowColor = "#FFFFFF",
    autoPlay = false,
    autoPlayInterval = 3,
}: Props) {
    const [activeIdx, setActiveIdx] = useState(0)
    const [prevIdx, setPrevIdx] = useState<number | null>(null)
    const [fading, setFading] = useState(false)
    const [loadedSet, setLoadedSet] = useState<Set<string>>(new Set())
    const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const autoTimer = useRef<ReturnType<typeof setInterval> | null>(null)

    // Preload all images eagerly when the set changes
    useEffect(() => {
        setActiveIdx(0)
        images.forEach((img) => {
            if (!img?.src || img.src.startsWith("data:")) return
            const el = new window.Image()
            el.onload = () => setLoadedSet((prev) => new Set(prev).add(img.src))
            if (img.srcSet) el.srcset = img.srcSet
            el.src = img.src
        })
    }, [images.map((i) => i?.src).join("|")]) // eslint-disable-line

    // Autoplay
    useEffect(() => {
        if (autoTimer.current) clearInterval(autoTimer.current)
        if (!autoPlay || images.length < 2) return
        autoTimer.current = setInterval(() => {
            setActiveIdx((prev) => (prev + 1) % images.length)
        }, autoPlayInterval * 1000)
        return () => {
            if (autoTimer.current) clearInterval(autoTimer.current)
        }
    }, [autoPlay, autoPlayInterval, images.length])

    const goTo = useCallback(
        (next: number) => {
            setActiveIdx((prev) => {
                if (next === prev) return prev
                setPrevIdx(prev)
                setFading(true)
                if (fadeTimer.current) clearTimeout(fadeTimer.current)
                fadeTimer.current = setTimeout(
                    () => {
                        setFading(false)
                        setPrevIdx(null)
                    },
                    Math.max(fadeDuration * 1000, 50)
                )
                return next
            })
        },
        [fadeDuration]
    )

    const goPrev = useCallback(
        () => goTo((activeIdx - 1 + images.length) % images.length),
        [goTo, activeIdx, images.length]
    )

    const goNext = useCallback(
        () => goTo((activeIdx + 1) % images.length),
        [goTo, activeIdx, images.length]
    )

    // No images — show empty / unconnected state
    if (!images.length) {
        return <EmptyState bg={background} radius={cornerRadius} />
    }

    const ratio = RATIO_MAP[aspectRatio] ?? 1
    const safeIdx = Math.min(activeIdx, images.length - 1)
    const activeImg = images[safeIdx]
    const prevImg = prevIdx !== null ? images[prevIdx] : null
    const zoomId = "pgz"

    return (
        <div
            style={{
                width: "100%",
                fontFamily: "Inter,sans-serif",
                userSelect: "none",
                boxSizing: "border-box",
                background,
                borderRadius: cornerRadius,
                overflow: "hidden",
            }}
        >
            {zoomDuration > 0 && (
                <style>{`
                    @keyframes ${zoomId} {
                        from { transform: scale(1); }
                        to   { transform: scale(1.08); }
                    }
                `}</style>
            )}

            {/* ── Main stage ── */}
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    paddingBottom: `${(1 / ratio) * 100}%`,
                    overflow: "hidden",
                    borderRadius: cornerRadius,
                    background,
                }}
            >
                {/* Outgoing image (fades out) */}
                {fading && prevImg?.src && (
                    <img
                        src={prevImg.src}
                        srcSet={prevImg.srcSet}
                        alt=""
                        aria-hidden="true"
                        style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: imageFit,
                            opacity: 0,
                            transition: `opacity ${fadeDuration}s ease`,
                            pointerEvents: "none",
                        }}
                    />
                )}

                {/* Active image */}
                {activeImg?.src && (
                    <img
                        key={activeImg.src}
                        src={activeImg.src}
                        srcSet={activeImg.srcSet}
                        sizes="(max-width:768px) 100vw, 800px"
                        alt={activeImg.alt ?? "Product image"}
                        draggable={false}
                        style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: imageFit,
                            opacity: fading ? 0 : 1,
                            transition: `opacity ${fadeDuration}s ease`,
                            animation:
                                zoomDuration > 0
                                    ? `${zoomId} ${zoomDuration}s ease-in-out infinite alternate`
                                    : "none",
                            willChange: "opacity",
                        }}
                    />
                )}

                {/* Arrows */}
                {images.length > 1 && (
                    <>
                        <button
                            onClick={goPrev}
                            aria-label="Previous image"
                            style={{
                                position: "absolute",
                                left: 12,
                                top: "50%",
                                transform: "translateY(-50%)",
                                width: 36,
                                height: 36,
                                borderRadius: "50%",
                                background: arrowBackground,
                                border: "none",
                                cursor: "pointer",
                                zIndex: 2,
                                padding: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: 0.85,
                                transition: "opacity 0.15s",
                            }}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.opacity = "1")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.opacity = "0.85")
                            }
                        >
                            <Arrow dir="left" color={arrowColor} />
                        </button>
                        <button
                            onClick={goNext}
                            aria-label="Next image"
                            style={{
                                position: "absolute",
                                right: 12,
                                top: "50%",
                                transform: "translateY(-50%)",
                                width: 36,
                                height: 36,
                                borderRadius: "50%",
                                background: arrowBackground,
                                border: "none",
                                cursor: "pointer",
                                zIndex: 2,
                                padding: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: 0.85,
                                transition: "opacity 0.15s",
                            }}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.opacity = "1")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.opacity = "0.85")
                            }
                        >
                            <Arrow dir="right" color={arrowColor} />
                        </button>
                    </>
                )}
            </div>

            {/* ── Thumbnail strip ── */}
            {images.length > 1 && (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        gap,
                        marginTop: gap,
                        overflowX: "auto",
                        padding: "2px 2px 4px",
                        // hide scrollbar cross-browser
                        msOverflowStyle: "none" as any,
                        scrollbarWidth: "none" as any,
                    }}
                >
                    <style>{`
                        .pg-strip::-webkit-scrollbar { display: none; }
                    `}</style>
                    {images.map((img, i) => {
                        const isActive = i === safeIdx
                        const isLoaded = img?.src
                            ? loadedSet.has(img.src)
                            : false
                        return (
                            <button
                                key={i}
                                onClick={() => goTo(i)}
                                aria-label={`View image ${i + 1}`}
                                style={{
                                    flexShrink: 0,
                                    width: thumbWidth,
                                    height: thumbHeight,
                                    borderRadius: thumbRadius,
                                    border: `${activeBorder}px solid ${isActive ? activeColor : "transparent"}`,
                                    padding: 0,
                                    cursor: "pointer",
                                    overflow: "hidden",
                                    boxSizing: "border-box",
                                    background,
                                    outline: "none",
                                    position: "relative",
                                    opacity: isActive ? 1 : 0.55,
                                    transition:
                                        "border-color 0.15s ease, opacity 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive)
                                        e.currentTarget.style.opacity = "0.8"
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive)
                                        e.currentTarget.style.opacity = "0.55"
                                }}
                            >
                                {img?.src && (
                                    <img
                                        src={img.src}
                                        srcSet={img.srcSet}
                                        sizes={`${thumbWidth}px`}
                                        alt={img.alt ?? `Thumbnail ${i + 1}`}
                                        draggable={false}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            opacity: isLoaded ? 1 : 0.4,
                                            transition: "opacity 0.2s",
                                        }}
                                    />
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ─── Property controls ────────────────────────────────────────────────────────

addPropertyControls(CMSPhotoGallery, {
    // ◈ The pin connector on this prop lets you bind directly to a CMS Gallery field.
    // On a Collection List item: click the ◈ dot → choose your Gallery field.
    images: {
        type: ControlType.Array,
        title: "Images",
        control: {
            type: ControlType.Object,
            controls: {
                src: { type: ControlType.Image, title: "Image" },
                srcSet: { type: ControlType.String, title: "srcSet" },
                alt: { type: ControlType.String, title: "Alt" },
            },
        },
    },
    zoomDuration: {
        type: ControlType.Number,
        title: "Zoom Dur...",
        defaultValue: 0,
        min: 0,
        max: 20,
        step: 0.5,
        unit: "s",
        description: "Zoom duration per slide in seconds. (0–20s)",
    },
    fadeDuration: {
        type: ControlType.Number,
        title: "Fade Dura...",
        defaultValue: 0.7,
        min: 0,
        max: 3,
        step: 0.1,
        unit: "s",
        description: "Cross-fade speed between slides in seconds. (0–3s)",
    },
    aspectRatio: {
        type: ControlType.Enum,
        title: "Aspect Ra...",
        defaultValue: "1:1",
        options: ["1:1", "4:3", "16:9", "3:4", "9:16"],
        optionTitles: [
            "1:1 Square",
            "4:3",
            "16:9",
            "3:4 Portrait",
            "9:16 Story",
        ],
        description: "Suggested 16:9 for Desktop, 4:3 for Mobile",
    },
    imageFit: {
        type: ControlType.Enum,
        title: "Image Fit",
        defaultValue: "cover",
        options: ["cover", "contain"],
        optionTitles: ["Cover", "Contain"],
    },
    cornerRadius: {
        type: ControlType.Number,
        title: "Corner Ra...",
        defaultValue: 20,
        min: 0,
        max: 80,
        step: 1,
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 4,
        min: 0,
        max: 24,
        step: 1,
    },
    thumbRadius: {
        type: ControlType.Number,
        title: "Thumb Ra...",
        defaultValue: 9,
        min: 0,
        max: 40,
        step: 1,
    },
    thumbWidth: {
        type: ControlType.Number,
        title: "Thumb Wi...",
        defaultValue: 200,
        min: 40,
        max: 400,
        step: 4,
    },
    thumbHeight: {
        type: ControlType.Number,
        title: "Thumb H...",
        defaultValue: 120,
        min: 40,
        max: 300,
        step: 4,
    },
    activeColor: {
        type: ControlType.Color,
        title: "Active Col...",
        defaultValue: "#FFFFFF",
    },
    activeBorder: {
        type: ControlType.Number,
        title: "Active Bor...",
        defaultValue: 3,
        min: 1,
        max: 8,
        step: 1,
    },
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#F9F9F9",
        description: "Background Colour. Adjust Opacity to hide",
    },
    arrowBackground: {
        type: ControlType.Color,
        title: "Arrow Ba...",
        defaultValue: "#000000",
    },
    arrowColor: {
        type: ControlType.Color,
        title: "Arrow Col...",
        defaultValue: "#FFFFFF",
    },
    autoPlay: {
        type: ControlType.Boolean,
        title: "Auto Play",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    autoPlayInterval: {
        type: ControlType.Number,
        title: "Interval",
        defaultValue: 3,
        min: 1,
        max: 20,
        step: 0.5,
        unit: "s",
        hidden: (p) => !p.autoPlay,
    },
})
