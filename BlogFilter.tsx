import { Override, Data } from "framer"

const blogData = Data({ tag: "" })

export function NewReleased(): Override {
    return {
        onTap() {
            blogData.tag = "new-released"
        },
    }
}

export function HotTopic(): Override {
    return {
        onTap() {
            blogData.tag = "hot-topic"
        },
    }
}

export function Popular(): Override {
    return {
        onTap() {
            blogData.tag = "popular"
        },
    }
}
