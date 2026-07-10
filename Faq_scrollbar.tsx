import type { ComponentType } from "react"

export function withSwipeScroll(Component): ComponentType {
    return ({ style, ...props }) => (
        <Component
            {...props}
            style={{
                ...style,
                overflowX: "scroll",
                overflowY: "hidden",
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                cursor: "grab",
            }}
        />
    )
}
