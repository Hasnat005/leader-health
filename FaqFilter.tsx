import { Override, Data } from "framer"

const data = Data({ category: "getting-started" })

// Put this override on each Category Tile
export function GettingStarted(): Override {
    return {
        onTap() {
            data.category = "getting-started"
        },
    }
}

export function MedicalCare(): Override {
    return {
        onTap() {
            data.category = "medical-care"
        },
    }
}

export function PrivacySecurity(): Override {
    return {
        onTap() {
            data.category = "privacy-security"
        },
    }
}

export function PricingPayment(): Override {
    return {
        onTap() {
            data.category = "pricing-payment"
        },
    }
}

export function SupportAccessibility(): Override {
    return {
        onTap() {
            data.category = "support-accessibility"
        },
    }
}

// Put this override on the FAQ Questions collection list
export function FAQFilter(): Override {
    return {
        filter: (item: any) => item.faqCategory?.slug === data.category,
    }
}
