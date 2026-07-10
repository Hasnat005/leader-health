import { Override } from "framer"

export function MasonryGrid(): Override {
    return {
        style: {
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px",
        },
        ref: (el: HTMLElement | null) => {
            if (!el) return
            const id = "blog-grid-style"
            if (!document.getElementById(id)) {
                const style = document.createElement("style")
                style.id = id
                style.textContent = `
                    .blog-grid > *:nth-child(1),
                    .blog-grid > *:nth-child(2) {
                        grid-column: span 1;
                    }
                    .blog-grid > *:nth-child(1) {
                        grid-column: 1 / 2;
                    }
                    .blog-grid > *:nth-child(2) {
                        grid-column: 2 / 4;
                    }
                `
                document.head.appendChild(style)
                el.classList.add("blog-grid")
            }
        },
    }
}
