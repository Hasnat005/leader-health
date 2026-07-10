// StarRatingSummary.tsx — Framer Code Component
// Renders: 4.8 ★★★★★ 1255 reviews

import { addPropertyControls, ControlType } from "framer"

function Star({
    fill,
    size,
    color,
    emptyColor,
}: {
    fill: "full" | "partial" | "empty"
    size: number
    color: string
    emptyColor: string
}) {
    const id = `star_grad_${Math.random().toString(36).slice(2, 7)}`

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            style={{ flexShrink: 0 }}
        >
            {fill === "partial" && (
                <defs>
                    <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
                        <stop offset="70%" stopColor={color} />
                        <stop offset="70%" stopColor={emptyColor} />
                    </linearGradient>
                </defs>
            )}
            <polygon
                points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                fill={
                    fill === "full"
                        ? color
                        : fill === "partial"
                          ? `url(#${id})`
                          : emptyColor
                }
                stroke="none"
            />
        </svg>
    )
}

function renderStars(
    rating: number,
    count: number,
    size: number,
    color: string,
    emptyColor: string
) {
    return Array.from({ length: count }).map((_, i) => {
        const fill =
            i < Math.floor(rating) ? "full" : i < rating ? "partial" : "empty"
        return (
            <Star
                key={i}
                fill={fill as "full" | "partial" | "empty"}
                size={size}
                color={color}
                emptyColor={emptyColor}
            />
        )
    })
}

export default function StarRatingSummary({
    rating,
    reviewCount,
    reviewLabel,
    showRatingNumber,
    showReviewCount,
    starCount,
    starSize,
    starColor,
    emptyColor,
    starGap,
    itemGap,
    ratingFontSize,
    ratingFontWeight,
    countFontSize,
    textColor,
    mutedColor,
    fontFamily,
}: {
    rating: number
    reviewCount: number
    reviewLabel: string
    showRatingNumber: boolean
    showReviewCount: boolean
    starCount: number
    starSize: number
    starColor: string
    emptyColor: string
    starGap: number
    itemGap: number
    ratingFontSize: number
    ratingFontWeight: number
    countFontSize: number
    textColor: string
    mutedColor: string
    fontFamily: string
}) {
    const displayRating = Math.min(Math.max(rating, 0), starCount)
    const formatted =
        displayRating % 1 === 0
            ? displayRating.toFixed(1)
            : displayRating.toFixed(1)

    return (
        <div
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: itemGap,
                fontFamily,
                lineHeight: 1,
            }}
        >
            {/* Rating number */}
            {showRatingNumber && (
                <span
                    style={{
                        fontSize: ratingFontSize,
                        fontWeight: ratingFontWeight,
                        color: textColor,
                        letterSpacing: "-0.01em",
                    }}
                >
                    {formatted}
                </span>
            )}

            {/* Stars */}
            <div
                style={{ display: "flex", alignItems: "center", gap: starGap }}
            >
                {renderStars(
                    displayRating,
                    starCount,
                    starSize,
                    starColor,
                    emptyColor
                )}
            </div>

            {/* Review count */}
            {showReviewCount && (
                <span
                    style={{
                        fontSize: countFontSize,
                        color: mutedColor,
                        fontWeight: 400,
                    }}
                >
                    {reviewCount.toLocaleString()} {reviewLabel}
                </span>
            )}
        </div>
    )
}

addPropertyControls(StarRatingSummary, {
    rating: {
        type: ControlType.Number,
        title: "Rating",
        defaultValue: 4.8,
        min: 0,
        max: 5,
        step: 0.1,
        displayStepper: true,
    },
    reviewCount: {
        type: ControlType.Number,
        title: "Review Count",
        defaultValue: 1255,
        min: 0,
        step: 1,
    },
    reviewLabel: {
        type: ControlType.String,
        title: "Label",
        defaultValue: "reviews",
    },
    showRatingNumber: {
        type: ControlType.Boolean,
        title: "Show Number",
        defaultValue: true,
    },
    showReviewCount: {
        type: ControlType.Boolean,
        title: "Show Count",
        defaultValue: true,
    },
    starCount: {
        type: ControlType.Number,
        title: "Star Count",
        defaultValue: 5,
        min: 1,
        max: 10,
        step: 1,
        displayStepper: true,
    },
    starSize: {
        type: ControlType.Number,
        title: "Star Size",
        defaultValue: 16,
        min: 10,
        max: 48,
        step: 1,
        displayStepper: true,
    },
    starColor: {
        type: ControlType.Color,
        title: "Star Color",
        defaultValue: "#F5A623",
    },
    emptyColor: {
        type: ControlType.Color,
        title: "Empty Star",
        defaultValue: "#D9D9D9",
    },
    starGap: {
        type: ControlType.Number,
        title: "Star Gap",
        defaultValue: 2,
        min: 0,
        max: 12,
        step: 1,
        displayStepper: true,
    },
    itemGap: {
        type: ControlType.Number,
        title: "Item Gap",
        defaultValue: 6,
        min: 0,
        max: 24,
        step: 1,
        displayStepper: true,
    },
    ratingFontSize: {
        type: ControlType.Number,
        title: "Rating Size",
        defaultValue: 15,
        min: 10,
        max: 48,
        step: 1,
        displayStepper: true,
    },
    ratingFontWeight: {
        type: ControlType.Number,
        title: "Rating Weight",
        defaultValue: 600,
        min: 300,
        max: 900,
        step: 100,
        displayStepper: true,
    },
    countFontSize: {
        type: ControlType.Number,
        title: "Count Size",
        defaultValue: 13,
        min: 10,
        max: 32,
        step: 1,
        displayStepper: true,
    },
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#111111",
    },
    mutedColor: {
        type: ControlType.Color,
        title: "Muted Color",
        defaultValue: "#888888",
    },
    fontFamily: {
        type: ControlType.String,
        title: "Font",
        defaultValue: "Inter, system-ui, sans-serif",
    },
})
