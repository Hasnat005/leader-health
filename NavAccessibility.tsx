import type { ComponentType } from "react"

export function withAriaNav(Component): ComponentType {
    return (props) => (
        <Component
            {...props}
            role="button"
            tabIndex={0}
            aria-label={props["aria-label"] || "Menu"}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    props.onClick?.()
                }
            }}
        />
    )
}
