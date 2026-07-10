import type { ComponentType } from "react"
import { useEffect, useRef } from "react"

const VERCEL_URL = "https://leaderhealth-subscribe.vercel.app"

export function CustomerIOForm(Component: ComponentType): ComponentType {
    return (props: any) => {
        const ref = useRef<HTMLDivElement>(null)

        useEffect(() => {
            const container = ref.current
            if (!container) return

            const handleClick = async () => {
                // Walk up the DOM to find the parent form's email input
                const form =
                    container.closest("form") || document.querySelector("form")
                const input = document.querySelector(
                    'input[type="email"]'
                ) as HTMLInputElement

                const email = input?.value?.trim()
                console.log("Email captured:", email)

                if (!email) return

                try {
                    const response = await fetch(
                        `${VERCEL_URL}/api/subscribe`,
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email }),
                        }
                    )
                    if (response.ok) {
                        console.log("Successfully subscribed:", email)
                    } else {
                        console.error("Failed:", await response.text())
                    }
                } catch (err) {
                    console.error("Network error:", err)
                }
            }

            container.addEventListener("click", handleClick)
            return () => container.removeEventListener("click", handleClick)
        }, [])

        return (
            <div ref={ref} style={{ display: "contents" }}>
                <Component {...props} />
            </div>
        )
    }
}

export function CustomerIOButton(Component: ComponentType): ComponentType {
    return CustomerIOForm(Component)
}
