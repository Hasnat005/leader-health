import { Override } from "framer"

export function Subscription(props): Override {
    return {
        visible: props.subscriptionRequired === true,
    }
}
