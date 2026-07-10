// import { addPropertyControls, ControlType } from "framer"
// import { useState } from "react"

// export default function FAQArticles({
//     faqData,
//     fontFamily,
//     questionColor,
//     answerColor,
//     activeColor,
//     hoverColor,
//     backgroundColor,
// }) {
//     const [openIndex, setOpenIndex] = useState(null)
//     const [hoveredIndex, setHoveredIndex] = useState(null)

//     let items = []
//     try {
//         items = JSON.parse(faqData || "[]")
//     } catch (e) {
//         return (
//             <div style={{ fontSize: 13, opacity: 0.4, fontFamily }}>
//                 Invalid FAQ data
//             </div>
//         )
//     }

//     if (items.length === 0) {
//         return (
//             <div style={{ fontSize: 13, opacity: 0.4, fontFamily }}>
//                 No FAQ items
//             </div>
//         )
//     }

//     return (
//         <div
//             style={{
//                 width: "100%",
//                 fontFamily,
//                 display: "flex",
//                 flexDirection: "column",
//                 gap: 8,
//             }}
//         >
//             {items.map((item, i) => {
//                 const isOpen = openIndex === i
//                 const isHovered = hoveredIndex === i
//                 const showAnswer = isOpen || isHovered

//                 return (
//                     <div
//                         key={i}
//                         onClick={() => setOpenIndex(isOpen ? null : i)}
//                         onMouseEnter={() => setHoveredIndex(i)}
//                         onMouseLeave={() => setHoveredIndex(null)}
//                         style={{
//                             borderRadius: 12,
//                             backgroundColor: isOpen
//                                 ? activeColor || "#ede9e3"
//                                 : isHovered
//                                   ? hoverColor || "#f0ece6"
//                                   : backgroundColor || "#f5f2ee",
//                             padding: "18px 20px",
//                             cursor: "pointer",
//                             transition:
//                                 "background-color 0.2s ease, box-shadow 0.2s ease",
//                             boxShadow: isHovered
//                                 ? "0 2px 12px rgba(0,0,0,0.07)"
//                                 : "none",
//                         }}
//                     >
//                         <div
//                             style={{
//                                 display: "flex",
//                                 alignItems: "center",
//                                 gap: 14,
//                             }}
//                         >
//                             <span
//                                 style={{
//                                     fontSize: 18,
//                                     fontWeight: 300,
//                                     color: questionColor || "#000000",
//                                     flexShrink: 0,
//                                     width: 20,
//                                     textAlign: "center",
//                                     display: "inline-block",
//                                     transform: isOpen
//                                         ? "rotate(45deg)"
//                                         : "rotate(0deg)",
//                                     transition: "transform 0.25s ease",
//                                     lineHeight: 1,
//                                 }}
//                             >
//                                 +
//                             </span>
//                             <span
//                                 style={{
//                                     fontSize: 15,
//                                     fontWeight: 500,
//                                     color: questionColor || "#000000",
//                                     lineHeight: 1.4,
//                                     flex: 1,
//                                 }}
//                             >
//                                 {item.q}
//                             </span>
//                         </div>

//                         <div
//                             style={{
//                                 maxHeight: showAnswer ? "600px" : "0px",
//                                 overflow: "hidden",
//                                 transition: "max-height 0.3s ease",
//                             }}
//                         >
//                             <p
//                                 style={{
//                                     fontSize: 14,
//                                     lineHeight: 1.7,
//                                     color: answerColor || "#555555",
//                                     margin: 0,
//                                     paddingTop: 12,
//                                     paddingLeft: 34,
//                                 }}
//                             >
//                                 {item.a}
//                             </p>
//                         </div>
//                     </div>
//                 )
//             })}
//         </div>
//     )
// }

// addPropertyControls(FAQArticles, {
//     faqData: {
//         type: ControlType.String,
//         title: "FAQ Data (JSON)",
//         defaultValue: "[]",
//         displayTextArea: true,
//     },
//     backgroundColor: {
//         type: ControlType.Color,
//         title: "Card Background",
//         defaultValue: "#f5f2ee",
//     },
//     hoverColor: {
//         type: ControlType.Color,
//         title: "Hover Background",
//         defaultValue: "#f0ece6",
//     },
//     activeColor: {
//         type: ControlType.Color,
//         title: "Open Background",
//         defaultValue: "#ede9e3",
//     },
//     questionColor: {
//         type: ControlType.Color,
//         title: "Question Color",
//         defaultValue: "#000000",
//     },
//     answerColor: {
//         type: ControlType.Color,
//         title: "Answer Color",
//         defaultValue: "#555555",
//     },
//     fontFamily: {
//         type: ControlType.String,
//         title: "Font Family",
//         defaultValue: "inherit",
//     },
// })
import { addPropertyControls, ControlType } from "framer"
import { useState, useEffect } from "react"

export default function FAQArticles({
    faqData,
    fontFamily,
    questionColor,
    answerColor,
    activeColor,
    hoverColor,
    backgroundColor,
}) {
    const [openIndex, setOpenIndex] = useState(null)
    const [hoveredIndex, setHoveredIndex] = useState(null)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const check = () =>
            setIsMobile(window.matchMedia("(hover: none)").matches)
        check()
        window.addEventListener("resize", check)
        return () => window.removeEventListener("resize", check)
    }, [])

    let items = []
    try {
        items = JSON.parse(faqData || "[]")
    } catch (e) {
        return (
            <div style={{ fontSize: 13, opacity: 0.4, fontFamily }}>
                Invalid FAQ data
            </div>
        )
    }

    if (items.length === 0) {
        return (
            <div style={{ fontSize: 13, opacity: 0.4, fontFamily }}>
                No FAQ items
            </div>
        )
    }

    return (
        <div
            style={{
                width: "100%",
                fontFamily,
                display: "flex",
                flexDirection: "column",
                gap: 8,
            }}
        >
            {items.map((item, i) => {
                const isOpen = openIndex === i
                const isHovered = hoveredIndex === i
                const showAnswer = isOpen || (!isMobile && isHovered)

                return (
                    <div
                        key={i}
                        onClick={() => setOpenIndex(isOpen ? null : i)}
                        onMouseEnter={() => !isMobile && setHoveredIndex(i)}
                        onMouseLeave={() => !isMobile && setHoveredIndex(null)}
                        style={{
                            borderRadius: 12,
                            backgroundColor: isOpen
                                ? activeColor || "#ede9e3"
                                : isHovered
                                  ? hoverColor || "#f0ece6"
                                  : backgroundColor || "#f5f2ee",
                            padding: "18px 20px",
                            cursor: "pointer",
                            transition:
                                "background-color 0.2s ease, box-shadow 0.2s ease",
                            boxShadow: isHovered
                                ? "0 2px 12px rgba(0,0,0,0.07)"
                                : "none",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 18,
                                    fontWeight: 300,
                                    color: questionColor || "#000000",
                                    flexShrink: 0,
                                    width: 20,
                                    textAlign: "center",
                                    display: "inline-block",
                                    transform: showAnswer
                                        ? "rotate(45deg)"
                                        : "rotate(0deg)",
                                    transition: "transform 0.25s ease",
                                    lineHeight: 1,
                                }}
                            >
                                +
                            </span>
                            <span
                                style={{
                                    fontSize: 15,
                                    fontWeight: 500,
                                    color: questionColor || "#000000",
                                    lineHeight: 1.4,
                                    flex: 1,
                                }}
                            >
                                {item.q}
                            </span>
                        </div>

                        <div
                            style={{
                                maxHeight: showAnswer ? "600px" : "0px",
                                overflow: "hidden",
                                transition: "max-height 0.3s ease",
                            }}
                        >
                            <p
                                style={{
                                    fontSize: 14,
                                    lineHeight: 1.7,
                                    color: answerColor || "#555555",
                                    margin: 0,
                                    paddingTop: 12,
                                    paddingLeft: 34,
                                }}
                            >
                                {item.a}
                            </p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

addPropertyControls(FAQArticles, {
    faqData: {
        type: ControlType.String,
        title: "FAQ Data (JSON)",
        defaultValue: "[]",
        displayTextArea: true,
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Card Background",
        defaultValue: "#f5f2ee",
    },
    hoverColor: {
        type: ControlType.Color,
        title: "Hover Background",
        defaultValue: "#f0ece6",
    },
    activeColor: {
        type: ControlType.Color,
        title: "Open Background",
        defaultValue: "#ede9e3",
    },
    questionColor: {
        type: ControlType.Color,
        title: "Question Color",
        defaultValue: "#000000",
    },
    answerColor: {
        type: ControlType.Color,
        title: "Answer Color",
        defaultValue: "#555555",
    },
    fontFamily: {
        type: ControlType.String,
        title: "Font Family",
        defaultValue: "inherit",
    },
})
