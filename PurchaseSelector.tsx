import { ComponentType } from "react"
import { createStore } from "https://framer.com/m/framer/store.js@^1.0.0"

const usePurchaseStore = createStore({ selected: null })

export function withOneTimePurchase(Component: ComponentType): ComponentType {
    return (props) => {
        const [store, setStore] = usePurchaseStore()
        return (
            <Component
                {...props}
                variant={
                    store.selected === "onepurchase"
                        ? "onepurchase-selected"
                        : "onepurchase-default"
                }
                onClick={() => setStore({ selected: "onepurchase" })}
            />
        )
    }
}

export function withSubscribeSave(Component: ComponentType): ComponentType {
    return (props) => {
        const [store, setStore] = usePurchaseStore()
        return (
            <Component
                {...props}
                variant={
                    store.selected === "subscribe"
                        ? "subscribe-selected"
                        : "subscribe-default"
                }
                onClick={() => setStore({ selected: "subscribe" })}
            />
        )
    }
}
