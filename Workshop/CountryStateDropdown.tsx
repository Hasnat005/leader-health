// Country and state dropdown component with dynamic state selection based on country
import { useState, startTransition, type CSSProperties } from "react"
import { addPropertyControls, ControlType } from "framer"

interface CountryStateDropdownProps {
    countryLabel: string
    stateLabel: string
    countryPlaceholder: string
    statePlaceholder: string
    backgroundColor: string
    textColor: string
    borderColor: string
    focusBorderColor: string
    borderRadius: number
    font: CSSProperties
    style?: CSSProperties
}

const countryStateData = {
    "United States": [
        "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
        "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
        "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
        "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
        "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
        "New Hampshire", "New Jersey", "New Mexico", "New York",
        "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
        "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
        "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
        "West Virginia", "Wisconsin", "Wyoming"
    ],
    "Canada": [
        "Alberta", "British Columbia", "Manitoba", "New Brunswick",
        "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia",
        "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan",
        "Yukon"
    ],
    "United Kingdom": [
        "England", "Scotland", "Wales", "Northern Ireland"
    ],
    "Australia": [
        "New South Wales", "Queensland", "South Australia", "Tasmania",
        "Victoria", "Western Australia", "Australian Capital Territory",
        "Northern Territory"
    ],
    "Germany": [
        "Baden-Württemberg", "Bavaria", "Berlin", "Brandenburg", "Bremen",
        "Hamburg", "Hesse", "Lower Saxony", "Mecklenburg-Vorpommern",
        "North Rhine-Westphalia", "Rhineland-Palatinate", "Saarland",
        "Saxony", "Saxony-Anhalt", "Schleswig-Holstein", "Thuringia"
    ],
    "India": [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
        "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
        "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
        "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
        "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
        "Uttarakhand", "West Bengal"
    ]
}

/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 */
export default function CountryStateDropdown(props: CountryStateDropdownProps) {
    const {
        countryLabel = "Country",
        stateLabel = "State/Province",
        countryPlaceholder = "Select a country",
        statePlaceholder = "Select a state",
        backgroundColor = "#FFFFFF",
        textColor = "#000000",
        borderColor = "#CCCCCC",
        focusBorderColor = "#000000",
        borderRadius = 8,
        font,
        style
    } = props

    const [selectedCountry, setSelectedCountry] = useState("")
    const [selectedState, setSelectedState] = useState("")
    const [countryFocused, setCountryFocused] = useState(false)
    const [stateFocused, setStateFocused] = useState(false)

    const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const country = e.target.value
        startTransition(() => {
            setSelectedCountry(country)
            setSelectedState("")
        })
    }

    const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        startTransition(() => {
            setSelectedState(e.target.value)
        })
    }

    const selectStyle: CSSProperties = {
        width: "100%",
        padding: "12px 16px",
        backgroundColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
        borderRadius,
        outline: "none",
        cursor: "pointer",
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='${encodeURIComponent(textColor)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 16px center",
        paddingRight: "40px",
        ...font
    }

    const labelStyle: CSSProperties = {
        display: "block",
        marginBottom: 8,
        color: textColor,
        ...font
    }

    const containerStyle: CSSProperties = {
        display: "flex",
        flexDirection: "column",
        gap: 20,
        width: "100%",
        ...style
    }

    const states = selectedCountry ? countryStateData[selectedCountry] || [] : []

    return (
        <div style={containerStyle}>
            <div style={{ width: "100%" }}>
                <label style={labelStyle}>{countryLabel}</label>
                <select
                    value={selectedCountry}
                    onChange={handleCountryChange}
                    onFocus={() => startTransition(() => setCountryFocused(true))}
                    onBlur={() => startTransition(() => setCountryFocused(false))}
                    style={{
                        ...selectStyle,
                        borderColor: countryFocused ? focusBorderColor : borderColor
                    }}
                >
                    <option value="">{countryPlaceholder}</option>
                    {Object.keys(countryStateData).map((country) => (
                        <option key={country} value={country}>
                            {country}
                        </option>
                    ))}
                </select>
            </div>

            <div style={{ width: "100%" }}>
                <label style={labelStyle}>{stateLabel}</label>
                <select
                    value={selectedState}
                    onChange={handleStateChange}
                    onFocus={() => startTransition(() => setStateFocused(true))}
                    onBlur={() => startTransition(() => setStateFocused(false))}
                    disabled={!selectedCountry}
                    style={{
                        ...selectStyle,
                        borderColor: stateFocused ? focusBorderColor : borderColor,
                        opacity: selectedCountry ? 1 : 0.5,
                        cursor: selectedCountry ? "pointer" : "not-allowed"
                    }}
                >
                    <option value="">{statePlaceholder}</option>
                    {states.map((state) => (
                        <option key={state} value={state}>
                            {state}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    )
}

addPropertyControls(CountryStateDropdown, {
    countryLabel: {
        type: ControlType.String,
        title: "Country Label",
        defaultValue: "Country"
    },
    stateLabel: {
        type: ControlType.String,
        title: "State Label",
        defaultValue: "State/Province"
    },
    countryPlaceholder: {
        type: ControlType.String,
        title: "Country Placeholder",
        defaultValue: "Select a country"
    },
    statePlaceholder: {
        type: ControlType.String,
        title: "State Placeholder",
        defaultValue: "Select a state"
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#FFFFFF"
    },
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#000000"
    },
    borderColor: {
        type: ControlType.Color,
        title: "Border Color",
        defaultValue: "#CCCCCC"
    },
    focusBorderColor: {
        type: ControlType.Color,
        title: "Focus Border",
        defaultValue: "#000000"
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Border Radius",
        defaultValue: 8,
        min: 0,
        max: 32,
        step: 1,
        unit: "px"
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: "15px",
            variant: "Medium",
            letterSpacing: "-0.01em",
            lineHeight: "1.3em"
        }
    }
})