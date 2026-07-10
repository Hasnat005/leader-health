import { addPropertyControls, ControlType } from "framer"

const rows = [
    {
        item: "Lab panels",
        policy: "Non-refundable once the order is placed with the lab or the draw occurs.",
    },
    {
        item: "Provider visits / consultations",
        policy: "Non-refundable once the visit occurs; any no-show / late-cancel fee is disclosed at booking.",
    },
    {
        item: "Therapy subscriptions",
        policy: "Cancel per the Subscription Terms; if the therapy carries a disclosed minimum term, that term governs; cancellation stops future charges.",
        link: { text: "Subscription Terms", url: "/legal/subscription-terms" },
    },
    {
        item: "Single-purchase items",
        policy: "Per the terms shown at purchase; ",
        bold: "single-purchase items are not subscriptions and do not auto-renew",
    },
    {
        item: "Dispensed prescription medications",
        policy: "Non-returnable, non-refundable once dispensed (federal and state law); safety and recall exceptions in the ",
        link: { text: "Shipping Policy", url: "/shipping-policy" },
        policySuffix: " still apply",
    },
]

export default function RefundTable() {
    return (
        <div
            style={{
                fontFamily: "Geist, sans-serif",
                fontSize: 16,
                color: "#321110",
                width: "100%",
            }}
        >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr>
                        <th style={thStyle}>Item</th>
                        <th style={thStyle}>Policy</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i}>
                            <td
                                style={{
                                    ...tdStyle,
                                    width: 240,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {row.item}
                            </td>
                            <td style={tdStyle}>
                                {row.policy}
                                {row.link && (
                                    <a
                                        href={row.link.url}
                                        style={{ color: "#321110" }}
                                    >
                                        {row.link.text}
                                    </a>
                                )}
                                {row.bold && <strong>{row.bold}</strong>}
                                {row.policySuffix}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

const thStyle: React.CSSProperties = {
    fontWeight: 700,
    textAlign: "left",
    padding: "10px 16px",
    borderBottom: "1px solid #321110",
    fontSize: 16,
    color: "#321110",
}

const tdStyle: React.CSSProperties = {
    padding: "10px 16px",
    verticalAlign: "top",
    borderBottom: "1px solid rgba(50,17,16,0.15)",
    fontSize: 16,
    color: "#321110",
    lineHeight: 1.5,
}
