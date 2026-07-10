/**
 * DuoPaneMegaNav — Framer Marketplace Code Component
 * React 18 · Clean-room implementation
 *
 * v1 property panel: Menu button → Mega menu → Primary links → Showcase → Carousel →
 * Menu links → Interaction → Mobile drawer. (Per-link CMS is compiled but off — see CMS_ENABLED.)
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 320
 * @framerIntrinsicHeight 56
 */

import * as React from "react"
import { addPropertyControls, ControlType } from "framer"
import { createPortal } from "react-dom"

/** When true, expose Per-link CMS in the panel + CMS slot pickers. v1 ships with this false. */
const CMS_ENABLED = true

// ─────────────────────────── Types ────────────────────────────

type OpenMode = "Hover" | "Click"
type PanelAlign = "Left" | "Center" | "Right"
type RightMode = "ItemArray" | "ItemCMS" | "GlobalArray" | "None"
type MobileMode = "DesktopOnly" | "MobileDrawer" | "Auto"

type ResponsiveImage = {
    src?: string | Record<string, unknown>
    srcSet?: string
    alt?: string
    url?: string
}

type Slide = {
    title: string
    description: string
    background: string
    image?: ResponsiveImage
    imageFit?: "cover" | "contain" | "fill" | "none"
    link?: string
}

type MobileSubItem = {
    title: string
    link?: string
}

type NavItem = {
    title: string
    description: string
    rightTitle?: string
    rightDescription?: string
    rightMode?: "Default" | "Slides" | "CMS"
    icon?: ResponsiveImage
    link?: string
    slides?: Slide[]
    mobileChildren?: MobileSubItem[]
    children?: MobileSubItem[]
}

type ColorsTrigger = {
    bg: string
    openBg: string
    text: string
    openText: string
}

type ColorsMenu = {
    bg: string
    border: string
}

type ColorsLinks = {
    title: string
    description: string
    icon: string
    hoverTitle: string
    hoverDescription: string
    hoverIcon: string
    hoverRowBg: string
    activeRowBg: string
}

type ColorsShowcase = {
    headline: string
    subhead: string
}

type ColorsSlides = {
    title: string
    caption: string
}

type ColorsMobile = {
    bg: string
    border: string
    text: string
    muted: string
    icon: string
    rowHoverBg: string
}

type ColorsProps = {
    trigger: ColorsTrigger
    menu: ColorsMenu
    links: ColorsLinks
    showcase: ColorsShowcase
    slides: ColorsSlides
    mobile: ColorsMobile
} & {
    // Backward compatibility (older grouped-but-flat keys)
    triggerBg: string
    triggerActiveBg: string
    triggerText: string
    triggerActiveText: string
    panelBg: string
    panelBorder: string
    leftTitle: string
    leftDesc: string
    leftIcon: string
    leftHoverTitle: string
    leftHoverDesc: string
    leftHoverIcon: string
    leftHoverRowBg: string
    leftActiveRowBg: string
    showcaseHeadline: string
    showcaseSubhead: string
    slideTitle: string
    slideCaption: string
    mobileBg: string
    mobileBorder: string
    mobileText: string
    mobileMuted: string
    mobileIcon: string
    mobileRowHoverBg: string
}

// ── Grouped prop shapes (mirror the ControlType.Object groups) ──

type TriggerProps = {
    label: string
    openMode: OpenMode
    /** When to use the mobile drawer vs the desktop mega menu */
    mobileLayout: MobileMode
    disabled: boolean
    font?: any
    fontSize: number
    paddingX: number
    paddingY: number
    radius: number
    bg: string
    hoverBg: string
    activeBg: string
    color: string
    activeColor: string
    showChevron: boolean
    chevronIcon?: ResponsiveImage
    chevronSize: number
}

type PanelProps = {
    align: PanelAlign
    offsetY: number
    width: number
    radius: number
    padding: number
    gap: number
    bg: string
    backdropBlur: number
    borderColor: string
    borderWidth: number
    shadow: string
    zIndex: number
}

type LeftProps = {
    width: number
    itemRadius: number
    itemPaddingX: number
    itemPaddingY: number
    itemGap: number
    iconSize: number
    titleFont?: any
    descFont?: any
    titleSize: number
    descSize: number
    titleColor: string
    descColor: string
    iconColor: string
    hoverTitleColor: string
    hoverDescColor: string
    hoverIconColor: string
    hoverItemBg: string
    activeItemBg: string
}

type RightProps = {
    mode: RightMode
    width: number
    slidesWidth: number
    cmsWidth: number
    /** Used when Display = Shared slides (stored here so it appears under Showcase). */
    sharedSlides?: Slide[]
    /** Optional heading above the slide area (from each link) */
    headerTitleFont?: any
    headerDescFont?: any
    headerTitleSize: number
    headerDescSize: number
    headerTitleColor: string
    headerDescColor: string
}

type CarouselProps = {
    height: number
    autoplay: boolean
    intervalMs: number
    transitionMs: number
    showArrows: boolean
    showDots: boolean
    /** Corner radius for slide cards and empty states */
    radius: number
    titleFont?: any
    descFont?: any
    titleSize: number
    descSize: number
    titleColor: string
    descColor: string
    globalSlides: Slide[]
}

type BehaviorProps = {
    openDelayMs: number
    closeDelayMs: number
    closeOnClick: boolean
    openOnFocus: boolean
    initialSelection: "None" | "First"
}

type MobileProps = {
    breakpoint: number
    width: number
    showHamburger: boolean
    hamburgerSize: number
    hamburgerIcon?: ResponsiveImage
    showIcons: boolean
    showDescriptions: boolean
    iconColor: string
    bg: string
    borderColor: string
    borderWidth: number
    textColor: string
    mutedColor: string
    itemGap: number
    rowHoverBg: string
    shadow: string
}

// NEW: Props for navbar layout
type NavbarProps = {
    height: number
    paddingX: number
    bg: string
    borderColor: string
    borderWidth: number
}

// ── Root props ──

export interface MegaMenuProps {
    trigger: TriggerProps
    panel: PanelProps
    left: LeftProps
    right: RightProps
    carousel: CarouselProps
    behavior: BehaviorProps
    mobile: MobileProps
    navbar: NavbarProps
    logo?: ResponsiveImage
    logoWidth: number
    logoLink?: string
    logoText: string
    showLogin: boolean
    loginLabel: string
    loginLink?: string
    loginIcon?: ResponsiveImage
    showGetStarted: boolean
    getStartedLabel: string
    getStartedLink?: string
    showRefreshIcon: boolean
    refreshIcon?: ResponsiveImage
    refreshLink?: string
    /** Consolidated color controls for easy editing after paste. */
    colors?: Partial<ColorsProps>
    items: NavItem[]
    mobileOnlyItems: NavItem[]
    // CMS component slots — wired when CMS_ENABLED; v1 hides them from the property panel.
    cmsSlot1?: React.ReactNode
    cmsSlot2?: React.ReactNode
    cmsSlot3?: React.ReactNode
    cmsSlot4?: React.ReactNode
    cmsSlot5?: React.ReactNode
    cmsSlot6?: React.ReactNode
    cmsSlot7?: React.ReactNode
    cmsSlot8?: React.ReactNode
    style?: React.CSSProperties
}

// ─────────────────────── Utility helpers ──────────────────────

function px(n: number) {
    return `${Math.round(n)}px`
}
function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v))
}
function cls(...a: (string | false | null | undefined)[]) {
    return a.filter(Boolean).join(" ")
}
const IMG_SRC_MAX_DEPTH = 8
const DESKTOP_PANEL_EXIT_MS = 260

/**
 * Resolves a URL from Framer ResponsiveImage (and common variants).
 * Framer may pass a string, only `srcSet`, nested `src`, `url`, or grouped objects.
 */
function imgSrc(img?: unknown, depth = 0): string {
    if (img == null || depth > IMG_SRC_MAX_DEPTH) return ""
    if (typeof img === "string") {
        const t = img.trim()
        return t
    }
    if (Array.isArray(img)) {
        for (const el of img) {
            const s = imgSrc(el, depth + 1)
            if (s) return s
        }
        return ""
    }
    if (typeof img !== "object") return ""

    const o = img as Record<string, unknown>
    const tryStr = (v: unknown) =>
        typeof v === "string" && v.trim() ? v.trim() : ""

    const direct =
        tryStr(o.src) ||
        tryStr(o.url) ||
        tryStr(o.uri) ||
        tryStr(o.href) ||
        tryStr(o.default)
    if (direct) return direct

    const nestedSrc = o.src
    if (nestedSrc && typeof nestedSrc === "object") {
        const inner = imgSrc(nestedSrc, depth + 1)
        if (inner) return inner
    }

    const srcSet = o.srcSet
    if (typeof srcSet === "string" && srcSet.trim()) {
        const first = srcSet.split(",")[0]?.trim()
        if (first) {
            const u = first.split(/\s+/)[0]
            if (u) return u
        }
    }

    for (const key of ["image", "file", "asset", "data", "value", "__framer"]) {
        const v = o[key]
        if (v == null) continue
        if (typeof v === "string" && v.trim()) return v.trim()
        const nested = imgSrc(v, depth + 1)
        if (nested) return nested
    }

    return ""
}

function getSampleSlidesForItem(item?: NavItem | null): Slide[] {
    if (!item) return []
    const title = (item.title || "").trim()
    const description = (item.description || "").trim()

    if (title === "Blog" && description === "Latest articles and insights.") {
        return [
            {
                title: "Designing Fluid Interfaces",
                description:
                    "Explore how modern interfaces use motion and depth to improve usability.",
                background: "#6B4C30",
            },
            {
                title: "Editorial Calendar",
                description:
                    "Plan launches, announcements, and content across every channel.",
                background: "#4C5E8F",
            },
        ]
    }
    if (
        title === "Docs" &&
        description === "Guides, references and API docs."
    ) {
        return [
            {
                title: "Getting Started",
                description:
                    "Learn the basics and ship your first setup in minutes.",
                background: "#2F74EE",
            },
            {
                title: "API Reference",
                description:
                    "Browse endpoints, payloads, and implementation examples.",
                background: "#1B5BCE",
            },
            {
                title: "Components",
                description:
                    "Use prebuilt patterns and adapt them to your product.",
                background: "#3B82F6",
            },
        ]
    }
    if (
        title === "Changelog" &&
        description === "What's new in the latest release."
    ) {
        return [
            {
                title: "Release Notes",
                description:
                    "Review new features, performance improvements, and bug fixes.",
                background: "#111827",
            },
            {
                title: "Performance",
                description:
                    "Faster loading, smoother navigation, and cleaner transitions.",
                background: "#374151",
            },
        ]
    }
    if (title === "Help Center" && description === "Find answers and support") {
        return [
            {
                title: "FAQs",
                description:
                    "Find quick answers to the questions teams ask most often.",
                background: "#CFB247",
            },
            {
                title: "Support guides",
                description:
                    "Troubleshoot issues and follow step-by-step solutions.",
                background: "#B89A35",
            },
            {
                title: "Contact support",
                description: "Reach the team when you need more hands-on help.",
                background: "#D7BE61",
            },
        ]
    }

    return []
}

function isSvg(src: string) {
    return src.startsWith("data:image/svg+xml") || /\.svg(\?.*)?$/i.test(src)
}

function fontStyle(f?: any): React.CSSProperties {
    if (!f) return {}
    const out: React.CSSProperties = {}
    for (const k of [
        "fontFamily",
        "fontWeight",
        "fontStyle",
        "letterSpacing",
        "lineHeight",
        "textTransform",
        "textDecoration",
    ] as const) {
        if ((f as any)[k] != null) (out as any)[k] = (f as any)[k]
    }
    return out
}

function safeHref(raw?: string) {
    const href = (raw || "").trim()
    if (!href) return ""

    // Block unsafe protocol URLs.
    if (/^\s*javascript:/i.test(href)) return ""

    // Best practice for Framer Link controls: keep href as provided.
    // Framer may supply internal links differently in canvas/preview/published.
    return href
}
const MAX_ITEMS = 8

// ─────────────────────── Component ────────────────────────────

export default function DuoPaneMegaNav(props: MegaMenuProps) {
    const {
        trigger,
        panel,
        left,
        right,
        carousel,
        behavior,
        mobile,
        navbar,
        logo,
        logoWidth,
        logoLink,
        logoText,
        showLogin,
        loginLabel,
        loginLink,
        loginIcon,
        showGetStarted,
        getStartedLabel,
        getStartedLink,
        showRefreshIcon,
        refreshIcon,
        refreshLink,
        colors: colorsRaw,
        items,
        mobileOnlyItems,
        cmsSlot1,
        cmsSlot2,
        cmsSlot3,
        cmsSlot4,
        cmsSlot5,
        cmsSlot6,
        cmsSlot7,
        cmsSlot8,
        style,
    } = props

    const colors: Partial<ColorsProps> = colorsRaw || {}
    const cTrigger = colors.trigger || ({} as Partial<ColorsTrigger>)
    const cMenu = colors.menu || ({} as Partial<ColorsMenu>)
    const cLinks = colors.links || ({} as Partial<ColorsLinks>)
    const cShowcase = colors.showcase || ({} as Partial<ColorsShowcase>)
    const cSlides = colors.slides || ({} as Partial<ColorsSlides>)
    const cMobile = colors.mobile || ({} as Partial<ColorsMobile>)

    const triggerBg = cTrigger.bg ?? colors.triggerBg ?? trigger.bg
    // Hover background can't override inline background reliably; use CSS brightness instead.
    const triggerActiveBg =
        cTrigger.openBg ?? colors.triggerActiveBg ?? trigger.activeBg
    const triggerText = cTrigger.text ?? colors.triggerText ?? trigger.color
    const triggerActiveText =
        cTrigger.openText ?? colors.triggerActiveText ?? trigger.activeColor

    const panelBg = cMenu.bg ?? colors.panelBg ?? panel.bg
    const panelBorder = cMenu.border ?? colors.panelBorder ?? panel.borderColor

    const leftTitle = cLinks.title ?? colors.leftTitle ?? left.titleColor
    const leftDesc = cLinks.description ?? colors.leftDesc ?? left.descColor
    const leftIcon = cLinks.icon ?? colors.leftIcon ?? left.iconColor
    const leftHoverTitle =
        cLinks.hoverTitle ?? colors.leftHoverTitle ?? left.hoverTitleColor
    const leftHoverDesc =
        cLinks.hoverDescription ?? colors.leftHoverDesc ?? left.hoverDescColor
    const leftHoverIcon =
        cLinks.hoverIcon ?? colors.leftHoverIcon ?? left.hoverIconColor
    const leftHoverRowBg =
        cLinks.hoverRowBg ?? colors.leftHoverRowBg ?? left.hoverItemBg
    const leftActiveRowBg =
        cLinks.activeRowBg ?? colors.leftActiveRowBg ?? left.activeItemBg

    const showcaseHeadline =
        cShowcase.headline ?? colors.showcaseHeadline ?? right.headerTitleColor
    const showcaseSubhead =
        cShowcase.subhead ?? colors.showcaseSubhead ?? right.headerDescColor

    const slideTitle = cSlides.title ?? colors.slideTitle ?? carousel.titleColor
    const slideCaption =
        cSlides.caption ?? colors.slideCaption ?? carousel.descColor

    const mobileBg = cMobile.bg ?? colors.mobileBg ?? mobile.bg
    const mobileBorder =
        cMobile.border ?? colors.mobileBorder ?? mobile.borderColor
    const mobileText = cMobile.text ?? colors.mobileText ?? mobile.textColor
    const mobileMuted = cMobile.muted ?? colors.mobileMuted ?? mobile.mutedColor
    const mobileIcon = cMobile.icon ?? colors.mobileIcon ?? mobile.iconColor
    const mobileRowHoverBg =
        cMobile.rowHoverBg ?? colors.mobileRowHoverBg ?? mobile.rowHoverBg

    const cmsSlots: React.ReactNode[] = [
        cmsSlot1,
        cmsSlot2,
        cmsSlot3,
        cmsSlot4,
        cmsSlot5,
        cmsSlot6,
        cmsSlot7,
        cmsSlot8,
    ]

    const legacyRight = right as Record<string, unknown>
    const legacyCarousel = carousel as Record<string, unknown>
    const slideLook = React.useMemo(() => {
        const L = legacyRight
        const C = legacyCarousel
        const nSlide = (key: string, fallback: number) => {
            const c = C[key]
            if (typeof c === "number") return c
            const x = L[key]
            return typeof x === "number" ? x : fallback
        }
        const sSlide = (key: string, fallback: string) => {
            const c = C[key]
            if (typeof c === "string" && c.length) return c
            const x = L[key]
            return typeof x === "string" ? x : fallback
        }
        const fSlide = (key: string) => C[key] ?? L[key]
        const nShowcase = (key: string, fallback: number) => {
            const r = L[key]
            if (typeof r === "number") return r
            const c = C[key]
            return typeof c === "number" ? c : fallback
        }
        const sShowcase = (key: string, fallback: string) => {
            const r = L[key]
            if (typeof r === "string" && r.length) return r
            const c = C[key]
            return typeof c === "string" ? c : fallback
        }
        const fShowcase = (key: string) => L[key] ?? C[key]
        return {
            radius: nSlide("radius", 14),
            titleFont: fSlide("titleFont"),
            descFont: fSlide("descFont"),
            titleSize: nSlide("titleSize", 16),
            descSize: nSlide("descSize", 13),
            titleColor: slideTitle,
            descColor: slideCaption,
            headerTitleFont: fShowcase("headerTitleFont"),
            headerDescFont: fShowcase("headerDescFont"),
            headerTitleSize: nShowcase("headerTitleSize", 20),
            headerDescSize: nShowcase("headerDescSize", 13),
            headerTitleColor: showcaseHeadline,
            headerDescColor: showcaseSubhead,
        }
    }, [
        carousel,
        right,
        slideTitle,
        slideCaption,
        showcaseHeadline,
        showcaseSubhead,
    ])

    const scope = React.useId().replace(/:/g, "s")
    const rootRef = React.useRef<HTMLDivElement>(null)
    const mobileLayerRef = React.useRef<HTMLDivElement>(null)

    // State for each button - which index is open (-1 = none)
    const [openIndex, setOpenIndex] = React.useState<number>(-1)
    const [panelMounted, setPanelMounted] = React.useState<number>(-1)
    const [panelActive, setPanelActive] = React.useState<number>(-1)
    const [mobileLayerMounted, setMobileLayerMounted] = React.useState(false)
    const [mobileLayerActive, setMobileLayerActive] = React.useState(false)
    const [hoveredIdx, setHoveredIdx] = React.useState(-1)
    const [mobileExpandedIdx, setMobileExpandedIdx] = React.useState(-1)
    const [slideIdx, setSlideIdx] = React.useState(0)
    const [viewportWidth, setViewportWidth] = React.useState(() =>
        typeof window === "undefined" ? 1280 : window.innerWidth
    )

    const openTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const autoTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const panelUnmountTimer = React.useRef<ReturnType<
        typeof setTimeout
    > | null>(null)
    const panelEnterRaf = React.useRef<number | null>(null)
    const mobileUnmountTimer = React.useRef<ReturnType<
        typeof setTimeout
    > | null>(null)
    const mobileEnterRaf = React.useRef<number | null>(null)
    const hoverEnableTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
        null
    )
    const hoverEnabledRef = React.useRef(false)

    const baseItems = items?.length ? items : []
    const mobileOnly = mobileOnlyItems?.length ? mobileOnlyItems : []
    const mobileLayoutMode =
        trigger.mobileLayout ?? (mobile as { mode?: MobileMode }).mode ?? "Auto"
    const isMobileMode =
        mobileLayoutMode === "MobileDrawer" ||
        (mobileLayoutMode === "Auto" && viewportWidth <= mobile.breakpoint)
    const navItems = isMobileMode ? [...baseItems, ...mobileOnly] : baseItems
    const rightMode = right.mode
    const sharedSlides: Slide[] =
        ((right as unknown as { sharedSlides?: Slide[] }).sharedSlides ??
            carousel.globalSlides ??
            []) ||
        []
    
    // Get active item based on openIndex for desktop, or hovered for the panel content
    const activeItemIndex = openIndex >= 0 ? openIndex : hoveredIdx
    const activeItem =
        activeItemIndex >= 0 && activeItemIndex < navItems.length
            ? navItems[activeItemIndex]
            : null
    const activeHeaderItem = activeItem
    const rightHeaderTitle = (
        activeHeaderItem?.rightTitle ||
        activeHeaderItem?.title ||
        ""
    ).trim()
    const rightHeaderDescription = (
        activeHeaderItem?.rightDescription ||
        activeHeaderItem?.description ||
        ""
    ).trim()
    const showRightHeader = Boolean(rightHeaderTitle || rightHeaderDescription)

    const activeSlides: Slide[] = React.useMemo(() => {
        const mode =
            !CMS_ENABLED && rightMode === "ItemCMS" ? "ItemArray" : rightMode
        if (mode === "GlobalArray") return sharedSlides
        if (mode === "ItemArray" && activeItem)
            return activeItem.slides?.length
                ? activeItem.slides
                : getSampleSlidesForItem(activeItem)
        return []
    }, [rightMode, activeItem, sharedSlides])

    const slideCount = activeSlides.length

    // ── Timers ──
    const clearTimers = React.useCallback(() => {
        if (openTimer.current) clearTimeout(openTimer.current)
        if (closeTimer.current) clearTimeout(closeTimer.current)
    }, [])

    const scheduleOpen = React.useCallback(
        (idx: number) => {
            clearTimers()
            openTimer.current = setTimeout(() => {
                setOpenIndex(idx)
            }, Math.max(0, behavior.openDelayMs))
        },
        [behavior.openDelayMs, clearTimers]
    )

    const scheduleClose = React.useCallback(() => {
        clearTimers()
        closeTimer.current = setTimeout(() => {
            setOpenIndex(-1)
        }, Math.max(0, behavior.closeDelayMs))
    }, [behavior.closeDelayMs, clearTimers])

    const immediateClose = React.useCallback(() => {
        clearTimers()
        setOpenIndex(-1)
    }, [clearTimers])

    const resetHoverGate = React.useCallback((delayMs = 260) => {
        hoverEnabledRef.current = false
        if (hoverEnableTimer.current) clearTimeout(hoverEnableTimer.current)
        hoverEnableTimer.current = setTimeout(
            () => {
                hoverEnabledRef.current = true
            },
            Math.max(0, delayMs)
        )
    }, [])

    React.useEffect(() => {
        if (openIndex < 0) return
        setSlideIdx(0)
        setHoveredIdx(
            behavior.initialSelection === "First" && navItems.length ? 0 : -1
        )
    }, [openIndex]) // eslint-disable-line

    React.useEffect(() => {
        setSlideIdx(0)
    }, [hoveredIdx])

    React.useEffect(() => {
        if (openIndex < 0) setMobileExpandedIdx(-1)
    }, [openIndex])

    React.useEffect(() => {
        if (isMobileMode) {
            if (panelUnmountTimer.current)
                clearTimeout(panelUnmountTimer.current)
            if (panelEnterRaf.current != null)
                cancelAnimationFrame(panelEnterRaf.current)
            panelEnterRaf.current = null
            setPanelActive(-1)
            setPanelMounted(-1)
            return
        }
        if (openIndex >= 0) {
            if (panelUnmountTimer.current)
                clearTimeout(panelUnmountTimer.current)
            if (panelEnterRaf.current != null)
                cancelAnimationFrame(panelEnterRaf.current)
            setPanelMounted(openIndex)
            return
        }
        if (panelEnterRaf.current != null)
            cancelAnimationFrame(panelEnterRaf.current)
        panelEnterRaf.current = null
        setPanelActive(-1)
        if (panelMounted < 0) return
        panelUnmountTimer.current = setTimeout(() => {
            setPanelMounted(-1)
        }, DESKTOP_PANEL_EXIT_MS)
        return () => {
            if (panelUnmountTimer.current)
                clearTimeout(panelUnmountTimer.current)
        }
    }, [isMobileMode, openIndex, panelMounted])

    React.useEffect(() => {
        if (isMobileMode || panelMounted < 0 || openIndex < 0) return
        panelEnterRaf.current = requestAnimationFrame(() => {
            panelEnterRaf.current = requestAnimationFrame(() => {
                setPanelActive(openIndex)
            })
        })
        return () => {
            if (panelEnterRaf.current != null)
                cancelAnimationFrame(panelEnterRaf.current)
        }
    }, [isMobileMode, panelMounted, openIndex])

    React.useEffect(() => {
        if (!isMobileMode) {
            if (mobileUnmountTimer.current)
                clearTimeout(mobileUnmountTimer.current)
            if (mobileEnterRaf.current != null)
                cancelAnimationFrame(mobileEnterRaf.current)
            mobileEnterRaf.current = null
            setMobileLayerActive(false)
            setMobileLayerMounted(false)
            return
        }
        if (openIndex >= 0) {
            if (mobileUnmountTimer.current)
                clearTimeout(mobileUnmountTimer.current)
            if (mobileEnterRaf.current != null)
                cancelAnimationFrame(mobileEnterRaf.current)
            setMobileLayerMounted(true)
            return
        }
        if (mobileEnterRaf.current != null)
            cancelAnimationFrame(mobileEnterRaf.current)
        mobileEnterRaf.current = null
        setMobileLayerActive(false)
        if (!mobileLayerMounted) return
        mobileUnmountTimer.current = setTimeout(() => {
            setMobileLayerMounted(false)
        }, 240)
        return () => {
            if (mobileUnmountTimer.current)
                clearTimeout(mobileUnmountTimer.current)
        }
    }, [isMobileMode, openIndex])

    React.useEffect(() => {
        if (!mobileLayerMounted || openIndex < 0) return
        mobileEnterRaf.current = requestAnimationFrame(() => {
            mobileEnterRaf.current = requestAnimationFrame(() => {
                setMobileLayerActive(true)
            })
        })
        return () => {
            if (mobileEnterRaf.current != null)
                cancelAnimationFrame(mobileEnterRaf.current)
        }
    }, [mobileLayerMounted, openIndex])

    React.useEffect(() => {
        if (openIndex < 0) return
        const shouldHandleOutside = isMobileMode || trigger.openMode === "Click"
        if (!shouldHandleOutside) return
        const h = (e: MouseEvent) => {
            const target = e.target as Node
            const inRoot = !!rootRef.current?.contains(target)
            const inMobileLayer = !!mobileLayerRef.current?.contains(target)
            if (!inRoot && !inMobileLayer) setOpenIndex(-1)
        }
        document.addEventListener("mousedown", h)
        return () => document.removeEventListener("mousedown", h)
    }, [openIndex, trigger.openMode, isMobileMode])

    React.useEffect(() => {
        if (openIndex < 0) return
        const h = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpenIndex(-1)
        }
        document.addEventListener("keydown", h)
        return () => document.removeEventListener("keydown", h)
    }, [openIndex])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        const onResize = () => setViewportWidth(window.innerWidth)
        window.addEventListener("resize", onResize)
        return () => window.removeEventListener("resize", onResize)
    }, [])

    React.useEffect(() => {
        return () => {
            if (panelUnmountTimer.current)
                clearTimeout(panelUnmountTimer.current)
            if (panelEnterRaf.current != null)
                cancelAnimationFrame(panelEnterRaf.current)
            if (mobileUnmountTimer.current)
                clearTimeout(mobileUnmountTimer.current)
            if (mobileEnterRaf.current != null)
                cancelAnimationFrame(mobileEnterRaf.current)
        }
    }, [])

    React.useEffect(() => {
        if (typeof window === "undefined") return

        resetHoverGate()

        const closeForNavigation = () => {
            clearTimers()
            setOpenIndex(-1)
            setHoveredIdx(-1)
            setMobileExpandedIdx(-1)
            resetHoverGate()
        }

        const onLocationChange = () => closeForNavigation()
        window.addEventListener("popstate", onLocationChange)
        window.addEventListener("hashchange", onLocationChange)
        window.addEventListener("framer:locationchange", onLocationChange)

        const w = window as any
        if (!w.__megaMenuHistoryPatched) {
            w.__megaMenuHistoryPatched = true
            const rawPush = history.pushState.bind(history)
            const rawReplace = history.replaceState.bind(history)
            history.pushState = function (...args: any[]) {
                const ret = rawPush(...args)
                window.dispatchEvent(new Event("framer:locationchange"))
                return ret
            }
            history.replaceState = function (...args: any[]) {
                const ret = rawReplace(...args)
                window.dispatchEvent(new Event("framer:locationchange"))
                return ret
            }
        }

        return () => {
            window.removeEventListener("popstate", onLocationChange)
            window.removeEventListener("hashchange", onLocationChange)
            window.removeEventListener(
                "framer:locationchange",
                onLocationChange
            )
            if (hoverEnableTimer.current) clearTimeout(hoverEnableTimer.current)
        }
    }, [clearTimers, resetHoverGate])

    React.useEffect(() => {
        if (autoTimer.current) clearTimeout(autoTimer.current)
        autoTimer.current = null
        if (openIndex < 0 || !carousel.autoplay || isMobileMode) return
        const isCarousel =
            rightMode === "ItemArray" || rightMode === "GlobalArray"
        if (!isCarousel || slideCount <= 1) return
        autoTimer.current = setTimeout(
            () => setSlideIdx((i) => (i + 1) % slideCount),
            Math.max(800, carousel.intervalMs)
        )
        return () => {
            if (autoTimer.current) clearTimeout(autoTimer.current)
        }
    }, [
        openIndex,
        carousel.autoplay,
        carousel.intervalMs,
        slideIdx,
        slideCount,
        rightMode,
        isMobileMode,
    ])

    const onTriggerEnter = (idx: number) => {
        if (isMobileMode) return
        if (!hoverEnabledRef.current) return
        if (!trigger.disabled && trigger.openMode === "Hover") scheduleOpen(idx)
    }
    const onTriggerLeave = () => {
        if (isMobileMode) return
        if (trigger.openMode === "Hover") scheduleClose()
    }
    const onTriggerClick = (idx: number) => {
        if (isMobileMode) {
            setOpenIndex((v) => (v === idx ? -1 : idx))
            return
        }
        if (!trigger.disabled && trigger.openMode === "Click")
            setOpenIndex((v) => (v === idx ? -1 : idx))
    }
    const onPanelEnter = () => {
        if (isMobileMode) return
        if (trigger.openMode === "Hover") {
            clearTimers()
        }
    }
    const onPanelLeave = () => {
        if (isMobileMode) return
        if (trigger.openMode === "Hover") scheduleClose()
    }

    const panelAlignStyle: React.CSSProperties =
        panel.align === "Center"
            ? { left: "50%", transform: "translateX(-50%)" }
            : panel.align === "Right"
              ? { right: 0 }
              : { left: 0 }

    const computePanelWidth = () => {
        const resolved = resolveItemRightMode()
        if (resolved === "None") return left.width + panel.padding * 2
        const isSlides = resolved === "GlobalArray" || resolved === "ItemArray"
        const rw = isSlides ? right.slidesWidth : right.cmsWidth
        return left.width + rw + panel.padding * 2 + panel.gap
    }

    const trgFont = fontStyle(trigger.font)
    const ltTitle = fontStyle(left.titleFont)
    const ltDesc = fontStyle(left.descFont)
    const rtTitle = fontStyle(slideLook.titleFont as any)
    const rtDesc = fontStyle(slideLook.descFont as any)
    const rhTitle = fontStyle(
        (slideLook.headerTitleFont || slideLook.titleFont) as any
    )
    const rhDesc = fontStyle(
        (slideLook.headerDescFont || slideLook.descFont) as any
    )

    const renderRightHeader = () => {
        if (!showRightHeader) return null
        return (
            <div className="nav-right-header">
                {rightHeaderTitle ? (
                    <div
                        className="nav-right-header-title"
                        style={{
                            ...rhTitle,
                            fontSize: slideLook.headerTitleSize,
                            color: showcaseHeadline,
                        }}
                    >
                        {rightHeaderTitle}
                    </div>
                ) : null}
                {rightHeaderDescription ? (
                    <div
                        className="nav-right-header-desc"
                        style={{
                            ...rhDesc,
                            fontSize: slideLook.headerDescSize,
                            color: showcaseSubhead,
                        }}
                    >
                        {rightHeaderDescription}
                    </div>
                ) : null}
            </div>
        )
    }

    // ── Carousel ──
    const renderCarousel = (slides: Slide[]) => {
        const count = slides.length
        const safe = count ? clamp(slideIdx, 0, count - 1) : 0
        return (
            <div
                className="nav-carousel"
                style={{
                    height: carousel.height,
                    borderRadius: slideLook.radius,
                }}
            >
                <div
                    className="nav-track"
                    style={{
                        transform: `translateX(-${safe * 100}%)`,
                        transitionDuration: `${carousel.transitionMs}ms`,
                    }}
                >
                    {slides.map((slide, i) => {
                        const src = imgSrc(slide.image)
                        const href = safeHref(slide.link)
                        const inner = (
                            <div
                                className="nav-slide"
                                style={{
                                    background: slide.background || "#2176FF",
                                }}
                            >
                                {src && (
                                    <img
                                        className="nav-slide-img"
                                        src={src}
                                        alt={slide.image?.alt || slide.title}
                                        style={{
                                            objectFit:
                                                slide.imageFit || "cover",
                                        }}
                                    />
                                )}
                                <div className="nav-slide-text">
                                    <div
                                        className="nav-slide-title"
                                        style={{
                                            ...rtTitle,
                                            fontSize: slideLook.titleSize,
                                            color: slideLook.titleColor,
                                        }}
                                    >
                                        {slide.title}
                                    </div>
                                    <div
                                        className="nav-slide-desc"
                                        style={{
                                            ...rtDesc,
                                            fontSize: slideLook.descSize,
                                            color: slideLook.descColor,
                                        }}
                                    >
                                        {slide.description}
                                    </div>
                                </div>
                            </div>
                        )
                        return href ? (
                            <a
                                key={i}
                                className="nav-slide-wrap nav-slide-link"
                                href={href}
                            >
                                {inner}
                            </a>
                        ) : (
                            <div key={i} className="nav-slide-wrap">
                                {inner}
                            </div>
                        )
                    })}
                </div>
                {carousel.showArrows && count > 1 && (
                    <>
                        <button
                            type="button"
                            className="nav-arrow nav-arrow-prev"
                            onClick={() =>
                                setSlideIdx((i) => (i - 1 + count) % count)
                            }
                            aria-label="Previous"
                        >
                            ‹
                        </button>
                        <button
                            type="button"
                            className="nav-arrow nav-arrow-next"
                            onClick={() => setSlideIdx((i) => (i + 1) % count)}
                            aria-label="Next"
                        >
                            ›
                        </button>
                    </>
                )}
                {carousel.showDots && count > 1 && (
                    <div className="nav-dots" aria-hidden="true">
                        {Array.from({ length: count }).map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                className={cls(
                                    "nav-dot",
                                    i === safe && "is-active"
                                )}
                                onClick={() => setSlideIdx(i)}
                                aria-label={`Slide ${i + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    // ── Right panel ──
    const resolveItemRightMode = (): RightMode => {
        if (rightMode === "None") return "None"
        if (rightMode === "GlobalArray") return "GlobalArray"
        const itemOverride = activeItem?.rightMode
        if (!itemOverride || itemOverride === "Default") {
            if (!CMS_ENABLED && rightMode === "ItemCMS") return "ItemArray"
            return rightMode
        }
        if (itemOverride === "CMS") return CMS_ENABLED ? "ItemCMS" : "ItemArray"
        if (itemOverride === "Slides") return "ItemArray"
        if (!CMS_ENABLED && rightMode === "ItemCMS") return "ItemArray"
        return rightMode
    }

    const renderRight = () => {
        const effectiveMode = resolveItemRightMode()
        if (effectiveMode === "None") return null
        const isSlides =
            effectiveMode === "GlobalArray" || effectiveMode === "ItemArray"
        const rightW = isSlides ? right.slidesWidth : right.cmsWidth
        if (effectiveMode === "GlobalArray")
            return (
                <div className="nav-right" style={{ width: rightW }}>
                    {renderRightHeader()}
                    {renderCarousel(sharedSlides)}
                </div>
            )
        if (effectiveMode === "ItemArray")
            return (
                <div className="nav-right" style={{ width: rightW }}>
                    {renderRightHeader()}
                    {activeItem ? (
                        renderCarousel(
                            activeItem.slides?.length
                                ? activeItem.slides
                                : getSampleSlidesForItem(activeItem)
                        )
                    ) : (
                        <div
                            className="nav-right-empty"
                            style={{
                                height: carousel.height,
                                borderRadius: slideLook.radius,
                            }}
                        />
                    )}
                </div>
            )
        if (effectiveMode === "ItemCMS") {
            const slotNode =
                activeItemIndex >= 0
                    ? (cmsSlots[activeItemIndex] ?? null)
                    : (cmsSlots[0] ?? null)
            return (
                <div className="nav-right" style={{ width: rightW }}>
                    {renderRightHeader()}
                    <div
                        className="nav-cms-wrap"
                        style={{ borderRadius: slideLook.radius }}
                    >
                        {slotNode}
                    </div>
                </div>
            )
        }
        return null
    }

    // ── Left list ──
    // Now the left panel shows the children/sub-items of the active category
    const renderLeft = () => {
        const currentItem = activeItem
        if (!currentItem) return null
        
        // Show children/sub-items if they exist, otherwise show the current item
        const children = currentItem.children || currentItem.mobileChildren || []
        const itemsToShow = children.length > 0 ? children : [{ title: currentItem.title, link: currentItem.link }]
        
        return (
            <div className="nav-left" style={{ width: left.width }}>
                {itemsToShow.map((child, idx) => {
                    const isHovered = idx === hoveredIdx
                    const href = safeHref(child.link)
                    const bgClr = isHovered ? leftHoverRowBg : "transparent"
                    const titleClr = isHovered ? leftHoverTitle : leftTitle
                    const descClr = isHovered ? leftHoverDesc : leftDesc
                    const iconClr = leftHoverIcon || leftIcon || "#FFFFFF"

                    const inner = (
                        <div
                            className="nav-item"
                            style={{
                                borderRadius: left.itemRadius,
                                padding: `${left.itemPaddingY}px ${left.itemPaddingX}px`,
                                gap: left.itemGap,
                                background: bgClr,
                            }}
                        >
                            <div
                                className="nav-icon-ph"
                                aria-hidden="true"
                                style={{
                                    width: left.iconSize,
                                    height: left.iconSize,
                                    backgroundColor: iconClr,
                                    opacity: 0.55,
                                }}
                            />
                            <div className="nav-item-text">
                                <div
                                    className="nav-item-title"
                                    style={{
                                        ...ltTitle,
                                        fontSize: left.titleSize,
                                        color: titleClr,
                                    }}
                                >
                                    {child.title}
                                </div>
                            </div>
                        </div>
                    )
                    const onEnter = () => setHoveredIdx(idx)
                    const onClick = () => {
                        if (behavior.closeOnClick) immediateClose()
                    }
                    return href ? (
                        <a
                            key={idx}
                            href={href}
                            className="nav-item-link"
                            onPointerEnter={onEnter}
                            onClick={onClick}
                        >
                            {inner}
                        </a>
                    ) : (
                        <button
                            key={idx}
                            type="button"
                            className="nav-item-btn"
                            onPointerEnter={onEnter}
                            onClick={onClick}
                        >
                            {inner}
                        </button>
                    )
                })}
            </div>
        )
    }

    const renderMobileDrawer = () => (
        <div
            className={cls("nav-mobile-drawer", mobileLayerActive && "is-open")}
            role="menu"
        >
            <div className="nav-mobile-list" style={{ gap: mobile.itemGap }}>
                {navItems.map((item, idx) => {
                    const src = imgSrc(item.icon)
                    const href = safeHref(item.link)
                    const children = item.mobileChildren || []
                    const isExpanded = mobileExpandedIdx === idx
                    const hasChildren = children.length > 0
                    const mobileIconClr =
                        mobileIcon || leftIcon || leftHoverIcon || "#FFFFFF"

                    const row = (
                        <div className="nav-mobile-item-inner">
                            {mobile.showIcons ? (
                                src ? (
                                    isSvg(src) ? (
                                        <span
                                            className="nav-mobile-icon-svg"
                                            aria-hidden="true"
                                            style={{
                                                width: left.iconSize,
                                                height: left.iconSize,
                                                backgroundColor: mobileIconClr,
                                                WebkitMaskImage: `url(${src})`,
                                                maskImage: `url(${src})`,
                                            }}
                                        />
                                    ) : (
                                        <img
                                            className="nav-mobile-icon"
                                            src={src}
                                            alt={item.icon?.alt || item.title}
                                            style={{
                                                width: left.iconSize,
                                                height: left.iconSize,
                                            }}
                                        />
                                    )
                                ) : (
                                    <span
                                        className="nav-mobile-icon-ph"
                                        aria-hidden="true"
                                        style={{
                                            width: left.iconSize,
                                            height: left.iconSize,
                                            background: mobileIconClr,
                                        }}
                                    />
                                )
                            ) : null}

                            <div className="nav-mobile-text">
                                <div
                                    className="nav-mobile-title"
                                    style={{
                                        ...ltTitle,
                                        fontSize: left.titleSize,
                                        color: mobileText,
                                    }}
                                >
                                    {item.title}
                                </div>
                                {mobile.showDescriptions && item.description ? (
                                    <div
                                        className="nav-mobile-desc"
                                        style={{
                                            ...ltDesc,
                                            fontSize: left.descSize,
                                            color: mobileMuted,
                                        }}
                                    >
                                        {item.description}
                                    </div>
                                ) : null}
                            </div>

                            {hasChildren ? (
                                <span
                                    className={cls(
                                        "nav-mobile-caret",
                                        isExpanded && "is-open"
                                    )}
                                >
                                    ▾
                                </span>
                            ) : null}
                        </div>
                    )

                    return (
                        <div className="nav-mobile-row" key={`mobile-${idx}`}>
                            {hasChildren ? (
                                <button
                                    type="button"
                                    className="nav-mobile-item-btn"
                                    onClick={() =>
                                        setMobileExpandedIdx((cur) =>
                                            cur === idx ? -1 : idx
                                        )
                                    }
                                >
                                    {row}
                                </button>
                            ) : href ? (
                                <a
                                    href={href}
                                    className="nav-mobile-item-link"
                                    onClick={() => {
                                        if (behavior.closeOnClick)
                                            immediateClose()
                                    }}
                                >
                                    {row}
                                </a>
                            ) : (
                                <button
                                    type="button"
                                    className="nav-mobile-item-btn"
                                    onClick={() => {}}
                                >
                                    {row}
                                </button>
                            )}

                            {hasChildren && isExpanded ? (
                                <div className="nav-mobile-children">
                                    {children.map((child, childIdx) => {
                                        const childHref = safeHref(child.link)
                                        return childHref ? (
                                            <a
                                                key={`mobile-child-${idx}-${childIdx}`}
                                                href={childHref}
                                                className="nav-mobile-child-link"
                                                onClick={() => {
                                                    if (behavior.closeOnClick)
                                                        immediateClose()
                                                }}
                                            >
                                                {child.title}
                                            </a>
                                        ) : (
                                            <div
                                                key={`mobile-child-${idx}-${childIdx}`}
                                                className="nav-mobile-child-link"
                                            >
                                                {child.title}
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : null}
                        </div>
                    )
                })}
            </div>
        </div>
    )

    const renderMobileLayer = () => {
        if (typeof document === "undefined" || !mobileLayerMounted) return null
        return createPortal(
            <div data-nav={scope} ref={mobileLayerRef}>
                <div
                    className={cls(
                        "nav-mobile-overlay",
                        mobileLayerActive && "is-open"
                    )}
                    onClick={() => setOpenIndex(-1)}
                    aria-hidden="true"
                />
                {renderMobileDrawer()}
            </div>,
            document.body
        )
    }

    const chevronSrc = imgSrc(trigger.chevronIcon)
    const logoSrc = imgSrc(logo)
    const loginIconSrc = imgSrc(loginIcon)
    const refreshIconSrc = imgSrc(refreshIcon)

    // Render the navbar structure
    const renderLogo = () => {
        const logoContent = (
            <div className="nav-logo" style={{ width: logoWidth, display: "flex", alignItems: "center", gap: 10 }}>
                {logoSrc ? (
                    <img
                        src={logoSrc}
                        alt={logo?.alt || "Logo"}
                        style={{ width: 24, height: 24, objectFit: "contain" }}
                    />
                ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.9 }}>
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M2 12h20"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                )}
                <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.02em", color: triggerText }}>
                    {logoText}
                </span>
            </div>
        )
        
        if (logoLink) {
            return (
                <a href={safeHref(logoLink)} className="nav-logo-link">
                    {logoContent}
                </a>
            )
        }
        return logoContent
    }

    const renderNavItems = () => {
        return (
            <div className="nav-items-container" style={{ display: "flex", gap: 4 }}>
                {navItems.slice(0, MAX_ITEMS).map((item, idx) => renderTriggerButton(item, idx))}
            </div>
        )
    }

    const renderLogin = () => {
        if (!showLogin) return null
        
        return (
            <a
                href={safeHref(loginLink)}
                className="nav-login"
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    textDecoration: "none",
                    color: triggerText,
                    fontSize: trigger.fontSize,
                    ...trgFont,
                }}
            >
                {loginIconSrc ? (
                    <img
                        src={loginIconSrc}
                        alt=""
                        style={{ width: 20, height: 20, objectFit: "contain" }}
                    />
                ) : (
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                )}
                {loginLabel && <span>{loginLabel}</span>}
            </a>
        )
    }

    const renderRightSection = () => {
        return (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {showGetStarted && (
                    <a
                        href={safeHref(getStartedLink)}
                        className="nav-get-started"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "10px 20px",
                            borderRadius: 999,
                            background: "#FFFFFF",
                            color: "#000000",
                            fontSize: 14,
                            fontWeight: 500,
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                            transition: "opacity 180ms ease",
                        }}
                    >
                        {getStartedLabel}
                    </a>
                )}
                {showRefreshIcon && (
                    <a
                        href={safeHref(refreshLink)}
                        className="nav-refresh"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 36,
                            height: 36,
                            borderRadius: 999,
                            background: "transparent",
                            color: triggerText,
                            textDecoration: "none",
                            transition: "opacity 180ms ease",
                        }}
                    >
                        {refreshIconSrc ? (
                            <img src={refreshIconSrc} alt="" style={{ width: 20, height: 20 }} />
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 4v6h-6"/>
                                <path d="M1 20v-6h6"/>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                            </svg>
                        )}
                    </a>
                )}
                {showLogin && renderLogin()}
            </div>
        )
    }

    // Render a trigger button for each nav item - pill style
    const renderTriggerButton = (item: NavItem, idx: number) => {
        const isOpen = openIndex === idx

        return (
            <button
                key={idx}
                type="button"
                className={cls("nav-trigger", isOpen && "is-open")}
                onClick={() => onTriggerClick(idx)}
                onPointerEnter={() => onTriggerEnter(idx)}
                onPointerLeave={onTriggerLeave}
                disabled={trigger.disabled}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                style={{
                    ...trgFont,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    border: "none",
                    outline: "none",
                    cursor: trigger.disabled ? "not-allowed" : "pointer",
                    padding: "10px 18px",
                    borderRadius: 999,
                    background: isOpen ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
                    color: triggerText,
                    fontSize: 14,
                    fontWeight: 500,
                    lineHeight: 1,
                    userSelect: "none",
                    transition: "background 180ms ease",
                    whiteSpace: "nowrap",
                }}
                onFocus={() => {
                    if (!behavior.openOnFocus || trigger.disabled) return
                    scheduleOpen(idx)
                }}
            >
                <span>{item.title}</span>
                <span
                    className="nav-chevron"
                    aria-hidden="true"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 14,
                        height: 14,
                        transformOrigin: "center",
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 220ms ease",
                        opacity: 0.7,
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path
                            d="M6 9l6 6 6-6"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </span>
            </button>
        )
    }

    // Determine if any panel is open
    const anyPanelOpen = openIndex >= 0

    return (
        <div
            ref={rootRef}
            data-nav={scope}
            className="nav-root"
            style={{
                ...style,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                height: navbar.height,
                paddingLeft: navbar.paddingX,
                paddingRight: navbar.paddingX,
                background: navbar.bg,
                borderBottom: navbar.borderWidth > 0 ? `${navbar.borderWidth}px solid ${navbar.borderColor}` : undefined,
                overflow: "visible",
                zIndex: panel.zIndex,
            }}
        >
            <style>{`
                [data-nav="${scope}"] * { box-sizing: border-box; }

                [data-nav="${scope}"] .nav-logo-link {
                    text-decoration: none;
                    display: flex;
                    align-items: center;
                }

                [data-nav="${scope}"] .nav-logo {
                    display: flex;
                    align-items: center;
                    flex-shrink: 0;
                }

                [data-nav="${scope}"] .nav-items-container {
                    position: absolute;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 8px;
                }

                [data-nav="${scope}"] .nav-login {
                    flex-shrink: 0;
                    transition: opacity 180ms ease;
                }
                [data-nav="${scope}"] .nav-login:hover {
                    opacity: 0.8;
                }

                [data-nav="${scope}"] .nav-get-started:hover {
                    opacity: 0.85;
                }

                [data-nav="${scope}"] .nav-refresh:hover {
                    background: rgba(255,255,255,0.1) !important;
                }

                [data-nav="${scope}"] .nav-trigger:hover { 
                    background: rgba(255,255,255,0.15) !important;
                }
                [data-nav="${scope}"] .nav-trigger.is-open {
                    background: rgba(255,255,255,0.2) !important;
                }

                [data-nav="${scope}"] .nav-chevron img { width: 100%; height: 100%; object-fit: contain; }

                [data-nav="${scope}"] .nav-panel {
                    position: absolute;
                    top: calc(100% + ${panel.offsetY}px);
                    max-width: calc(100vw - 24px);
                    border-radius: ${px(panel.radius)};
                    border: ${panel.borderWidth}px solid ${panelBorder};
                    box-shadow: ${panel.shadow};
                    padding: ${px(panel.padding)};
                    gap: ${px(panel.gap)};
                    display: grid;
                    grid-template-columns: ${rightMode === "None" ? "1fr" : `${left.width}px 1fr`};
                    align-items: start; overflow: hidden;
                    backdrop-filter: blur(${panel.backdropBlur}px);
                    -webkit-backdrop-filter: blur(${panel.backdropBlur}px);
                    z-index: ${panel.zIndex};
                    opacity: 0;
                    transform: translateY(-6px) scale(0.985);
                    pointer-events: none;
                    transform-origin: top center;
                    will-change: transform, opacity;
                    transition:
                        opacity ${DESKTOP_PANEL_EXIT_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
                        transform ${DESKTOP_PANEL_EXIT_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
                }
                [data-nav="${scope}"] .nav-panel.is-open {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                    pointer-events: auto;
                }
                [data-nav="${scope}"] .nav-panel::before {
                    content: ""; position: absolute; inset: 0;
                    background: ${panelBg}; z-index: 0; pointer-events: none;
                }
                [data-nav="${scope}"] .nav-panel > * { position: relative; z-index: 1; }

                [data-nav="${scope}"] .nav-mobile-overlay {
                    position: fixed; inset: 0;
                    background: rgba(0,0,0,0.42);
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 180ms ease;
                    z-index: ${panel.zIndex - 1};
                }
                [data-nav="${scope}"] .nav-mobile-overlay.is-open {
                    opacity: 1;
                    pointer-events: auto;
                }
                [data-nav="${scope}"] .nav-mobile-drawer {
                    position: fixed;
                    top: 0; left: 0; bottom: 0;
                    width: min(${mobile.width}px, 92vw);
                    background: ${mobileBg};
                    border-right: ${mobile.borderWidth}px solid ${mobileBorder};
                    box-shadow: ${mobile.shadow};
                    padding: 14px;
                    overflow: auto;
                    transform: translateX(-100%);
                    opacity: 0;
                    pointer-events: none;
                    transition:
                        transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
                        opacity 220ms ease;
                    z-index: ${panel.zIndex};
                }
                [data-nav="${scope}"] .nav-mobile-drawer.is-open {
                    transform: translateX(0);
                    opacity: 1;
                    pointer-events: auto;
                }
                [data-nav="${scope}"] .nav-mobile-list {
                    display: flex;
                    flex-direction: column;
                    gap: ${mobile.itemGap}px;
                }
                [data-nav="${scope}"] .nav-mobile-row { width: 100%; }
                [data-nav="${scope}"] .nav-mobile-item-link,
                [data-nav="${scope}"] .nav-mobile-item-btn {
                    width: 100%;
                    border: 0;
                    text-align: left;
                    text-decoration: none;
                    color: inherit;
                    background: transparent;
                    cursor: pointer;
                    padding: 0;
                }
                [data-nav="${scope}"] .nav-mobile-item-inner {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    padding: 10px 10px;
                    border-radius: 10px;
                }
                [data-nav="${scope}"] .nav-mobile-item-link:hover .nav-mobile-item-inner,
                [data-nav="${scope}"] .nav-mobile-item-btn:hover .nav-mobile-item-inner {
                    background: ${mobileRowHoverBg};
                }
                [data-nav="${scope}"] .nav-mobile-icon,
                [data-nav="${scope}"] .nav-mobile-icon-ph {
                    border-radius: 6px;
                    object-fit: cover;
                    flex: 0 0 auto;
                }
                [data-nav="${scope}"] .nav-mobile-icon-svg {
                    display: block;
                    border-radius: 6px;
                    flex: 0 0 auto;
                    -webkit-mask-repeat: no-repeat;
                    mask-repeat: no-repeat;
                    -webkit-mask-position: center;
                    mask-position: center;
                    -webkit-mask-size: contain;
                    mask-size: contain;
                }
                [data-nav="${scope}"] .nav-mobile-icon-ph {
                    opacity: 0.28;
                }
                [data-nav="${scope}"] .nav-mobile-text {
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    flex: 1;
                }
                [data-nav="${scope}"] .nav-mobile-title {
                    font-weight: 600;
                    line-height: 1.2;
                }
                [data-nav="${scope}"] .nav-mobile-desc {
                    line-height: 1.35;
                }
                [data-nav="${scope}"] .nav-mobile-caret {
                    color: ${mobileMuted};
                    transition: transform 160ms ease;
                    transform-origin: center;
                }
                [data-nav="${scope}"] .nav-mobile-caret.is-open {
                    transform: rotate(180deg);
                }
                [data-nav="${scope}"] .nav-mobile-children {
                    margin-left: ${mobile.showIcons ? left.iconSize + 20 : 8}px;
                    padding: 2px 0 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                [data-nav="${scope}"] .nav-mobile-child-link {
                    color: ${mobileMuted};
                    text-decoration: none;
                    font-size: ${Math.max(11, left.descSize)}px;
                    line-height: 1.35;
                    padding: 6px 10px;
                    border-radius: 8px;
                    display: block;
                }
                [data-nav="${scope}"] .nav-mobile-child-link:hover {
                    background: ${mobileRowHoverBg};
                    color: ${mobileText};
                }

                [data-nav="${scope}"] .nav-left { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
                [data-nav="${scope}"] .nav-item-link,
                [data-nav="${scope}"] .nav-slide-link { text-decoration: none; color: inherit; display: block; }
                [data-nav="${scope}"] .nav-item-btn {
                    background: transparent; border: 0; padding: 0;
                    text-align: left; cursor: pointer; display: block; width: 100%;
                }
                [data-nav="${scope}"] .nav-item { display: flex; align-items: flex-start; transition: background 140ms ease; }
                [data-nav="${scope}"] .nav-icon-img { border-radius: 8px; flex: 0 0 auto; object-fit: cover; }
                [data-nav="${scope}"] .nav-icon-svg {
                    display: block; flex: 0 0 auto;
                    -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
                    -webkit-mask-position: center; mask-position: center;
                    -webkit-mask-size: contain; mask-size: contain;
                }
                [data-nav="${scope}"] .nav-icon-ph { border-radius: 8px; flex: 0 0 auto; }
                [data-nav="${scope}"] .nav-item-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
                [data-nav="${scope}"] .nav-item-title { font-weight: 600; line-height: 1.2; }
                [data-nav="${scope}"] .nav-item-desc  { opacity: 0.85; line-height: 1.35; }

                [data-nav="${scope}"] .nav-right {
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                [data-nav="${scope}"] .nav-right-header {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    padding: 2px 2px 0 2px;
                }
                [data-nav="${scope}"] .nav-right-header-title {
                    font-weight: 600;
                    line-height: 1.2;
                }
                [data-nav="${scope}"] .nav-right-header-desc {
                    line-height: 1.35;
                    opacity: 0.9;
                }
                [data-nav="${scope}"] .nav-right-empty { background: rgba(255,255,255,0.04); }
                [data-nav="${scope}"] .nav-cms-wrap { height: 100%; overflow: hidden; }

                [data-nav="${scope}"] .nav-carousel { position: relative; overflow: hidden; width: 100%; }
                [data-nav="${scope}"] .nav-track {
                    display: flex; height: 100%; will-change: transform;
                    transition-property: transform; transition-timing-function: ease;
                }
                [data-nav="${scope}"] .nav-slide-wrap { flex: 0 0 100%; width: 100%; height: 100%; }
                [data-nav="${scope}"] .nav-slide {
                    width: 100%; height: 100%; position: relative;
                    display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden;
                }
                [data-nav="${scope}"] .nav-slide-img { position: absolute; inset: 0; width: 100%; height: 100%; }
                [data-nav="${scope}"] .nav-slide-text {
                    position: relative; padding: 16px; display: flex; flex-direction: column; gap: 4px;
                    background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%);
                }
                [data-nav="${scope}"] .nav-slide-title { font-weight: 600; line-height: 1.2; }
                [data-nav="${scope}"] .nav-slide-desc  { opacity: 0.85; line-height: 1.35; }

                [data-nav="${scope}"] .nav-arrow {
                    position: absolute; top: 50%; transform: translateY(-50%);
                    width: 34px; height: 34px; border-radius: 999px; border: 0;
                    cursor: pointer; background: rgba(255,255,255,0.18);
                    color: #fff; font-size: 22px;
                    display: inline-flex; align-items: center; justify-content: center;
                    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
                }
                [data-nav="${scope}"] .nav-arrow-prev { left: 10px; }
                [data-nav="${scope}"] .nav-arrow-next { right: 10px; }

                [data-nav="${scope}"] .nav-dots {
                    position: absolute; left: 0; right: 0; bottom: 10px;
                    display: flex; justify-content: center; gap: 6px;
                }
                [data-nav="${scope}"] .nav-dot {
                    width: 7px; height: 7px; border-radius: 999px; border: 0;
                    cursor: pointer; background: rgba(255,255,255,0.30); transition: background 140ms ease;
                }
                [data-nav="${scope}"] .nav-dot.is-active { background: rgba(255,255,255,0.90); }
            `}</style>

            {renderLogo()}
            {renderNavItems()}
            {renderRightSection()}

            {isMobileMode
                ? renderMobileLayer()
                : panelMounted >= 0 && (
                      <div
                          className={cls("nav-panel", panelActive === panelMounted && "is-open")}
                          style={{
                              ...panelAlignStyle,
                              width: computePanelWidth(),
                          }}
                          onPointerEnter={onPanelEnter}
                          onPointerLeave={onPanelLeave}
                          role="menu"
                      >
                          {renderLeft()}
                          {renderRight()}
                      </div>
                  )}
        </div>
    )
}

// ─────────────── Default Props ────────────────────────────────

DuoPaneMegaNav.defaultProps = {
    trigger: {
        label: "Resources",
        openMode: "Hover",
        mobileLayout: "Auto",
        disabled: false,
        fontSize: 14,
        paddingX: 14,
        paddingY: 10,
        radius: 999,
        bg: "rgba(255,255,255,0.08)",
        hoverBg: "rgba(255,255,255,0.13)",
        activeBg: "rgba(255,255,255,0.18)",
        color: "#FFFFFF",
        activeColor: "#FFFFFF",
        showChevron: true,
        chevronSize: 16,
    },
    colors: {
        triggerBg: "rgba(255,255,255,0.08)",
        triggerActiveBg: "rgba(255,255,255,0.18)",
        triggerText: "#FFFFFF",
        triggerActiveText: "#FFFFFF",

        panelBg: "rgba(10,10,14,0.72)",
        panelBorder: "rgba(255,255,255,0.14)",

        leftTitle: "rgba(255,255,255,0.92)",
        leftDesc: "rgba(255,255,255,0.60)",
        leftIcon: "rgba(255,255,255,0.80)",
        leftHoverTitle: "#FFFFFF",
        leftHoverDesc: "rgba(255,255,255,0.80)",
        leftHoverIcon: "#FFFFFF",
        leftHoverRowBg: "rgba(255,255,255,0.08)",
        leftActiveRowBg: "rgba(255,255,255,0.10)",

        showcaseHeadline: "#FFFFFF",
        showcaseSubhead: "rgba(255,255,255,0.85)",

        slideTitle: "#FFFFFF",
        slideCaption: "rgba(255,255,255,0.85)",

        mobileBg: "rgba(18,18,24,0.98)",
        mobileBorder: "rgba(255,255,255,0.12)",
        mobileText: "#F2F2F4",
        mobileMuted: "rgba(242,242,244,0.72)",
        mobileIcon: "#F2F2F4",
        mobileRowHoverBg: "rgba(255,255,255,0.08)",
    },
    panel: {
        align: "Left",
        offsetY: 10,
        width: 720,
        radius: 18,
        padding: 14,
        gap: 12,
        bg: "rgba(10,10,14,0.72)",
        backdropBlur: 20,
        borderColor: "rgba(255,255,255,0.14)",
        borderWidth: 1,
        shadow: "0 24px 60px rgba(0,0,0,0.22)",
        zIndex: 50,
    },
    left: {
        width: 260,
        itemRadius: 12,
        itemPaddingX: 10,
        itemPaddingY: 10,
        itemGap: 10,
        iconSize: 28,
        titleSize: 14,
        descSize: 12,
        titleColor: "rgba(255,255,255,0.92)",
        descColor: "rgba(255,255,255,0.60)",
        iconColor: "rgba(255,255,255,0.80)",
        hoverTitleColor: "#FFFFFF",
        hoverDescColor: "rgba(255,255,255,0.80)",
        hoverIconColor: "#FFFFFF",
        hoverItemBg: "rgba(255,255,255,0.08)",
        activeItemBg: "rgba(255,255,255,0.10)",
    },
    right: {
        mode: "ItemArray",
        width: 400,
        slidesWidth: 400,
        cmsWidth: 400,
        sharedSlides: [
            {
                title: "Designing Fluid Interfaces",
                description:
                    "Explore how modern interfaces use motion and depth to improve usability.",
                background: "#6B4C30",
            },
            {
                title: "Getting Started",
                description:
                    "See the setup guide, API docs, and implementation patterns in one place.",
                background: "#2F74EE",
            },
            {
                title: "Release Notes",
                description:
                    "Review the latest updates, fixes, and improvements across the product.",
                background: "#C7A73A",
            },
        ],
        headerTitleSize: 20,
        headerDescSize: 13,
        headerTitleColor: "#FFFFFF",
        headerDescColor: "rgba(255,255,255,0.85)",
    },
    carousel: {
        height: 260,
        autoplay: true,
        intervalMs: 2800,
        transitionMs: 400,
        showArrows: true,
        showDots: true,
        radius: 14,
        titleSize: 16,
        descSize: 13,
        titleColor: "#FFFFFF",
        descColor: "rgba(255,255,255,0.85)",
        globalSlides: [],
    },
    behavior: {
        openDelayMs: 60,
        closeDelayMs: 160,
        closeOnClick: true,
        openOnFocus: false,
        initialSelection: "First",
    },
    mobile: {
        breakpoint: 900,
        width: 320,
        showHamburger: true,
        hamburgerSize: 18,
        showIcons: true,
        showDescriptions: true,
        iconColor: "#F2F2F4",
        bg: "rgba(18,18,24,0.98)",
        borderColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        textColor: "#F2F2F4",
        mutedColor: "rgba(242,242,244,0.72)",
        itemGap: 4,
        rowHoverBg: "rgba(255,255,255,0.08)",
        shadow: "0 24px 48px rgba(0,0,0,0.35)",
    },
    navbar: {
        height: 64,
        paddingX: 24,
        bg: "rgba(10,10,14,0.95)",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
    },
    logoWidth: 120,
    showLogin: true,
    loginLabel: "Login",
    items: [
        {
            title: "Hormone Health",
            description: "Balance and optimize your hormones.",
            rightTitle: "Hormone Health",
            rightDescription: "Personalized treatments for hormonal wellness.",
            mobileChildren: [
                { title: "HRT Therapy", link: "" },
                { title: "Thyroid Health", link: "" },
                { title: "Lab Testing", link: "" },
            ],
            slides: [
                {
                    title: "HRT Therapy",
                    description:
                        "Bioidentical hormone replacement therapy tailored to your needs.",
                    background: "#8B5CF6",
                },
                {
                    title: "Thyroid Optimization",
                    description:
                        "Comprehensive thyroid testing and treatment plans.",
                    background: "#A78BFA",
                },
            ],
        },
        {
            title: "Sexual Health",
            description: "Confidential care for intimate wellness.",
            rightTitle: "Sexual Health",
            rightDescription: "Discreet, personalized solutions for men and women.",
            mobileChildren: [
                { title: "Erectile Dysfunction", link: "" },
                { title: "Low Libido", link: "" },
                { title: "Performance", link: "" },
            ],
            slides: [
                {
                    title: "Erectile Dysfunction",
                    description:
                        "Effective treatments delivered discreetly to your door.",
                    background: "#EC4899",
                },
                {
                    title: "Low Libido Solutions",
                    description:
                        "Address underlying causes and restore your vitality.",
                    background: "#F472B6",
                },
            ],
        },
        {
            title: "Weight Loss",
            description: "Medically supervised weight management.",
            rightTitle: "Weight Loss",
            rightDescription: "Science-backed programs for lasting results.",
            mobileChildren: [
                { title: "GLP-1 Medications", link: "" },
                { title: "Nutrition Plans", link: "" },
                { title: "Coaching", link: "" },
            ],
            slides: [
                {
                    title: "GLP-1 Medications",
                    description:
                        "Prescription treatments that curb appetite and boost metabolism.",
                    background: "#10B981",
                },
                {
                    title: "Personalized Coaching",
                    description:
                        "One-on-one support from medical professionals.",
                    background: "#34D399",
                },
            ],
        },
        {
            title: "Blog",
            description: "Latest articles and insights.",
            rightTitle: "Blog",
            rightDescription: "The latest news and updates.",
            mobileChildren: [
                { title: "Latest posts", link: "" },
                { title: "Announcements", link: "" },
                { title: "Product news", link: "" },
            ],
            slides: [
                {
                    title: "Designing Fluid Interfaces",
                    description:
                        "Explore how modern interfaces use motion and depth to improve usability.",
                    background: "#6B4C30",
                },
                {
                    title: "Editorial Calendar",
                    description:
                        "Plan launches, announcements, and content across every channel.",
                    background: "#4C5E8F",
                },
            ],
        },
    ],
    mobileOnlyItems: [
        {
            title: "Community",
            description: "Templates, examples and discussions.",
        },
        {
            title: "Contact",
            description: "Talk to sales or support.",
        },
    ],
} as MegaMenuProps

/** Framer: mobile layout moved from `mobile` → `trigger.mobileLayout`; old files may still set `mobile.mode`. */
function readMobileLayout(p: {
    trigger?: { mobileLayout?: MobileMode }
    mobile?: { mode?: MobileMode }
}): MobileMode {
    return p.trigger?.mobileLayout ?? p.mobile?.mode ?? "Auto"
}

// ─────────────── Property Controls ────────────────────────────
// Every section is a ControlType.Object → appears as a collapsible
// group in the Framer canvas sidebar with a ▸ disclosure arrow.

addPropertyControls(DuoPaneMegaNav, {
    // Per-link CMS (cmsSlot1–8 + ItemCMS mode): not in v1 panel — set CMS_ENABLED true and
    // register ComponentInstance controls when shipping.

    trigger: {
        type: ControlType.Object,
        title: "① Menu button",
        description:
            "Label, how it opens, when to use the mobile drawer, and button styling.",
        controls: {
            label: {
                type: ControlType.String,
                title: "Label",
                defaultValue: "Products",
                description: "Text shown on the trigger button.",
            },
            openMode: {
                type: ControlType.Enum,
                title: "Open on",
                options: ["Hover", "Click"],
                optionTitles: ["Hover", "Click"],
                defaultValue: "Hover",
                description: "Opens the panel on hover or on click.",
            },
            mobileLayout: {
                type: ControlType.Enum,
                title: "Small screens",
                options: ["DesktopOnly", "Auto", "MobileDrawer"],
                optionTitles: ["Desktop Only", "Auto", "Always Mobile"],
                defaultValue: "Auto",
                description:
                    "Desktop Only — always use the wide mega menu. " +
                    "Auto — use the drawer when the window is narrower than the breakpoint (set under Mobile drawer). " +
                    "Always Mobile — always use the drawer.",
            },
            disabled: {
                type: ControlType.Boolean,
                title: "Disabled",
                defaultValue: false,
                description: "Prevents the trigger from opening the panel.",
            },
            font: {
                type: ControlType.Font,
                title: "Font",
                controls: "basic",
                displayTextAlignment: false,
                displayFontSize: false,
                defaultFontType: "sans-serif",
                defaultValue: { variant: "Medium" },
            },
            fontSize: {
                type: ControlType.Number,
                title: "Font Size",
                min: 10,
                max: 28,
                step: 1,
                defaultValue: 14,
            },
            paddingX: {
                type: ControlType.Number,
                title: "Padding X",
                min: 0,
                max: 40,
                step: 1,
                defaultValue: 14,
            },
            paddingY: {
                type: ControlType.Number,
                title: "Padding Y",
                min: 0,
                max: 30,
                step: 1,
                defaultValue: 10,
            },
            radius: {
                type: ControlType.Number,
                title: "Radius",
                min: 0,
                max: 999,
                step: 1,
                defaultValue: 999,
            },
            bg: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "rgba(255,255,255,0.08)",
                hidden: () => true,
            },
            hoverBg: {
                type: ControlType.Color,
                title: "Hover Background",
                defaultValue: "rgba(255,255,255,0.13)",
                hidden: () => true,
            },
            activeBg: {
                type: ControlType.Color,
                title: "Open Background",
                defaultValue: "rgba(255,255,255,0.18)",
                hidden: () => true,
            },
            color: {
                type: ControlType.Color,
                title: "Text Color",
                defaultValue: "#FFFFFF",
                hidden: () => true,
            },
            activeColor: {
                type: ControlType.Color,
                title: "Open Text Color",
                defaultValue: "#FFFFFF",
                hidden: () => true,
            },
            showChevron: {
                type: ControlType.Boolean,
                title: "Show Chevron",
                defaultValue: true,
            },
            chevronIcon: {
                type: ControlType.ResponsiveImage,
                title: "Custom Chevron",
                description:
                    "Custom chevron image. Leave empty for the built-in arrow.",
            },
            chevronSize: {
                type: ControlType.Number,
                title: "Chevron Size",
                min: 10,
                max: 32,
                step: 1,
                defaultValue: 16,
            },
        },
    },

    panel: {
        type: ControlType.Object,
        title: "② Mega menu",
        description:
            "The open panel: size, position, glass/blur, border, and stacking.",
        controls: {
            align: {
                type: ControlType.Enum,
                title: "Alignment",
                options: ["Left", "Center", "Right"],
                defaultValue: "Left",
                description:
                    "Horizontal anchor of the dropdown relative to the trigger.",
            },
            offsetY: {
                type: ControlType.Number,
                title: "Vertical Offset",
                min: 0,
                max: 60,
                step: 1,
                defaultValue: 10,
                description:
                    "Gap between the trigger bottom and the panel top (px).",
            },
            width: {
                type: ControlType.Number,
                title: "Total Width",
                min: 320,
                max: 1400,
                step: 10,
                defaultValue: 720,
                description:
                    "Full width of the open panel. Ignored when Showcase mode is None.",
            },
            radius: {
                type: ControlType.Number,
                title: "Corner Radius",
                min: 0,
                max: 40,
                step: 1,
                defaultValue: 18,
            },
            padding: {
                type: ControlType.Number,
                title: "Padding",
                min: 0,
                max: 40,
                step: 1,
                defaultValue: 14,
            },
            gap: {
                type: ControlType.Number,
                title: "Column Gap",
                min: 0,
                max: 40,
                step: 1,
                defaultValue: 12,
                description: "Space between Primary links and Showcase.",
            },
            bg: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "rgba(10,10,14,0.72)",
                hidden: () => true,
            },
            backdropBlur: {
                type: ControlType.Number,
                title: "Backdrop Blur",
                min: 0,
                max: 60,
                step: 1,
                defaultValue: 20,
                description: "backdrop-filter blur strength in pixels.",
            },
            borderColor: {
                type: ControlType.Color,
                title: "Border Color",
                defaultValue: "rgba(255,255,255,0.14)",
                hidden: () => true,
            },
            borderWidth: {
                type: ControlType.Number,
                title: "Border Width",
                min: 0,
                max: 6,
                step: 1,
                defaultValue: 1,
            },
            shadow: {
                type: ControlType.BoxShadow,
                title: "Shadow",
                defaultValue: "0 24px 60px rgba(0,0,0,0.22)",
            },
            zIndex: {
                type: ControlType.Number,
                title: "Z-Index",
                min: 0,
                max: 9999,
                step: 1,
                defaultValue: 50,
            },
        },
    },

    left: {
        type: ControlType.Object,
        title: "③ Primary links",
        description:
            "The clickable list in the first column (icons, titles, hover).",
        controls: {
            width: {
                type: ControlType.Number,
                title: "Column Width",
                min: 140,
                max: 520,
                step: 10,
                defaultValue: 260,
            },
            itemRadius: {
                type: ControlType.Number,
                title: "Row radius",
                min: 0,
                max: 28,
                step: 1,
                defaultValue: 12,
            },
            itemPaddingX: {
                type: ControlType.Number,
                title: "Row padding X",
                min: 0,
                max: 24,
                step: 1,
                defaultValue: 10,
            },
            itemPaddingY: {
                type: ControlType.Number,
                title: "Row padding Y",
                min: 0,
                max: 24,
                step: 1,
                defaultValue: 10,
            },
            itemGap: {
                type: ControlType.Number,
                title: "Icon–Text Gap",
                min: 0,
                max: 24,
                step: 1,
                defaultValue: 10,
                description: "Gap between the icon and the text block.",
            },
            iconSize: {
                type: ControlType.Number,
                title: "Icon Size",
                min: 0,
                max: 56,
                step: 1,
                defaultValue: 28,
            },
            titleFont: {
                type: ControlType.Font,
                title: "Title Font",
                controls: "basic",
                displayTextAlignment: false,
                displayFontSize: false,
                defaultFontType: "sans-serif",
                defaultValue: { variant: "Semibold" },
            },
            descFont: {
                type: ControlType.Font,
                title: "Description Font",
                controls: "basic",
                displayTextAlignment: false,
                displayFontSize: false,
                defaultFontType: "sans-serif",
                defaultValue: { variant: "Regular" },
            },
            titleSize: {
                type: ControlType.Number,
                title: "Title Size",
                min: 10,
                max: 24,
                step: 1,
                defaultValue: 14,
            },
            descSize: {
                type: ControlType.Number,
                title: "Description Size",
                min: 10,
                max: 22,
                step: 1,
                defaultValue: 12,
            },
            titleColor: {
                type: ControlType.Color,
                title: "Title Color",
                defaultValue: "rgba(255,255,255,0.92)",
                hidden: () => true,
            },
            descColor: {
                type: ControlType.Color,
                title: "Description Color",
                defaultValue: "rgba(255,255,255,0.60)",
                hidden: () => true,
            },
            iconColor: {
                type: ControlType.Color,
                title: "Icon Color",
                defaultValue: "rgba(255,255,255,0.80)",
                description:
                    "Colorizes SVG icons via CSS mask. No effect on PNG/JPG.",
                hidden: () => true,
            },
            hoverTitleColor: {
                type: ControlType.Color,
                title: "Hover Title Color",
                defaultValue: "#FFFFFF",
                hidden: () => true,
            },
            hoverDescColor: {
                type: ControlType.Color,
                title: "Hover Desc Color",
                defaultValue: "rgba(255,255,255,0.80)",
                hidden: () => true,
            },
            hoverIconColor: {
                type: ControlType.Color,
                title: "Hover Icon Color",
                defaultValue: "#FFFFFF",
                hidden: () => true,
            },
            hoverItemBg: {
                type: ControlType.Color,
                title: "Hover Row Background",
                defaultValue: "rgba(255,255,255,0.08)",
                hidden: () => true,
            },
            activeItemBg: {
                type: ControlType.Color,
                title: "Active Row Background",
                defaultValue: "rgba(255,255,255,0.10)",
                description: "Background for the active link row.",
                hidden: () => true,
            },
        },
    },

    right: {
        type: ControlType.Object,
        title: "④ Showcase",
        description:
            "The spotlight beside Primary links: width and what fills it (slides or one shared carousel).",
        controls: {
            mode: {
                type: ControlType.Enum,
                title: "Display",
                options: ["None", "ItemArray", "GlobalArray"],
                optionTitles: ["Hidden", "Unique per link", "Shared slides"],
                defaultValue: "ItemArray",
                description:
                    "Hidden — only the link list is visible. " +
                    "Unique per link — hover a menu link to see its own slides (add them in Menu links). " +
                    "Shared slides — every link shows the same slide deck (edit it below).",
            },
            width: {
                type: ControlType.Number,
                title: "Width (legacy)",
                min: 160,
                max: 800,
                step: 10,
                defaultValue: 400,
                hidden: () => true,
            },
            slidesWidth: {
                type: ControlType.Number,
                title: "Column width",
                min: 160,
                max: 800,
                step: 10,
                defaultValue: 400,
                description: "Width when slides are visible.",
            },
            sharedSlides: {
                type: ControlType.Array,
                title: "Shared slides",
                maxCount: 12,
                // Framer passes either the full props or the parent object here depending on context.
                hidden: (p: any) =>
                    (p?.mode ?? p?.right?.mode) !== "GlobalArray",
                description:
                    "Shown when Display = Shared slides. This deck is used for every link.",
                control: {
                    type: ControlType.Object,
                    controls: {
                        title: {
                            type: ControlType.String,
                            title: "Title",
                            defaultValue: "Slide Title",
                        },
                        description: {
                            type: ControlType.String,
                            title: "Description",
                            defaultValue: "Caption.",
                        },
                        background: {
                            type: ControlType.Color,
                            title: "Background",
                            defaultValue: "#2176FF",
                        },
                        image: {
                            type: ControlType.ResponsiveImage,
                            title: "Image",
                        },
                        imageFit: {
                            type: ControlType.Enum,
                            title: "Image Fit",
                            options: ["cover", "contain", "fill", "none"],
                            optionTitles: ["Cover", "Contain", "Fill", "None"],
                            defaultValue: "cover",
                        },
                        link: {
                            type: ControlType.Link,
                            title: "Link",
                            defaultValue: "",
                        },
                    },
                },
            },
            cmsWidth: {
                type: ControlType.Number,
                title: "CMS width (reserved)",
                min: 160,
                max: 800,
                step: 10,
                defaultValue: 400,
                description: "Used when Per-link CMS ships. Hidden in v1.",
                hidden: () => true,
            },
            headerTitleFont: {
                type: ControlType.Font,
                title: "Headline font",
                controls: "basic",
                displayTextAlignment: false,
                displayFontSize: false,
                defaultFontType: "sans-serif",
                defaultValue: { variant: "Semibold" },
            },
            headerDescFont: {
                type: ControlType.Font,
                title: "Subhead font",
                controls: "basic",
                displayTextAlignment: false,
                displayFontSize: false,
                defaultFontType: "sans-serif",
                defaultValue: { variant: "Regular" },
            },
            headerTitleSize: {
                type: ControlType.Number,
                title: "Headline size",
                min: 12,
                max: 48,
                step: 1,
                defaultValue: 20,
                description:
                    "Main heading above the slide area (from each link’s title).",
            },
            headerDescSize: {
                type: ControlType.Number,
                title: "Subhead size",
                min: 10,
                max: 32,
                step: 1,
                defaultValue: 13,
                description: "Supporting line under the headline.",
            },
            headerTitleColor: {
                type: ControlType.Color,
                title: "Headline color",
                defaultValue: "#FFFFFF",
                hidden: () => true,
            },
            headerDescColor: {
                type: ControlType.Color,
                title: "Subhead color",
                defaultValue: "rgba(255,255,255,0.85)",
                hidden: () => true,
            },
        },
    },

    carousel: {
        type: ControlType.Object,
        title: "⑤ Carousel",
        description:
            "Motion, slide card shape, and slide title & caption styling.",
        controls: {
            height: {
                type: ControlType.Number,
                title: "Height",
                min: 120,
                max: 560,
                step: 10,
                defaultValue: 260,
                description: "Height of the carousel in pixels.",
            },
            autoplay: {
                type: ControlType.Boolean,
                title: "Autoplay",
                defaultValue: true,
            },
            intervalMs: {
                type: ControlType.Number,
                title: "Autoplay Interval",
                min: 800,
                max: 10000,
                step: 100,
                defaultValue: 2800,
                description: "Milliseconds between automatic slide advances.",
            },
            transitionMs: {
                type: ControlType.Number,
                title: "Transition Duration",
                min: 80,
                max: 1200,
                step: 10,
                defaultValue: 400,
                description: "Slide animation duration in milliseconds.",
            },
            showArrows: {
                type: ControlType.Boolean,
                title: "Show Arrows",
                defaultValue: true,
            },
            showDots: {
                type: ControlType.Boolean,
                title: "Show Dots",
                defaultValue: true,
            },
            radius: {
                type: ControlType.Number,
                title: "Slide corners",
                min: 0,
                max: 40,
                step: 1,
                defaultValue: 14,
                description: "Rounded corners on slide cards and empty states.",
            },
            titleFont: {
                type: ControlType.Font,
                title: "Slide title",
                controls: "basic",
                displayTextAlignment: false,
                displayFontSize: false,
                defaultFontType: "sans-serif",
                defaultValue: { variant: "Semibold" },
            },
            descFont: {
                type: ControlType.Font,
                title: "Slide caption",
                controls: "basic",
                displayTextAlignment: false,
                displayFontSize: false,
                defaultFontType: "sans-serif",
                defaultValue: { variant: "Regular" },
            },
            titleSize: {
                type: ControlType.Number,
                title: "Slide title size",
                min: 12,
                max: 32,
                step: 1,
                defaultValue: 16,
            },
            descSize: {
                type: ControlType.Number,
                title: "Slide caption size",
                min: 10,
                max: 24,
                step: 1,
                defaultValue: 13,
            },
            titleColor: {
                type: ControlType.Color,
                title: "Slide title color",
                defaultValue: "#FFFFFF",
                hidden: () => true,
            },
            descColor: {
                type: ControlType.Color,
                title: "Slide caption color",
                defaultValue: "rgba(255,255,255,0.85)",
                hidden: () => true,
            },
        },
    },

    items: {
        type: ControlType.Array,
        title: "⑥ Menu links",
        maxCount: MAX_ITEMS,
        description:
            "Your navigation links (top to bottom = order in Primary links). Add slides for each link when Display = Unique per link.",
        control: {
            type: ControlType.Object,
            controls: {
                title: {
                    type: ControlType.String,
                    title: "Label",
                    defaultValue: "New link",
                    description: "Headline shown in Primary links.",
                },
                description: {
                    type: ControlType.String,
                    title: "Description",
                    defaultValue: "Short description.",
                    description: "Supporting text beneath the label.",
                },
                rightTitle: {
                    type: ControlType.String,
                    title: "Showcase title",
                    defaultValue: "",
                    description:
                        "Optional heading above the Showcase for this link.",
                },
                rightDescription: {
                    type: ControlType.String,
                    title: "Showcase subtitle",
                    defaultValue: "",
                    description:
                        "Optional supporting line above the Showcase for this link.",
                },
                icon: {
                    type: ControlType.ResponsiveImage,
                    title: "Icon",
                    description:
                        "SVG icons are colorized automatically. PNG/JPG display as-is.",
                },
                link: {
                    type: ControlType.Link,
                    title: "Link URL",
                    defaultValue: "",
                    description:
                        "Renders as <a> when set, otherwise a <button>.",
                },
                slides: {
                    type: ControlType.Array,
                    title: "Slides",
                    maxCount: 8,
                    description:
                        "Slides for this link when Display = Unique per link.",
                    control: {
                        type: ControlType.Object,
                        controls: {
                            title: {
                                type: ControlType.String,
                                title: "Title",
                                defaultValue: "Slide",
                            },
                            description: {
                                type: ControlType.String,
                                title: "Description",
                                defaultValue: "Description.",
                            },
                            background: {
                                type: ControlType.Color,
                                title: "Background",
                                defaultValue: "#2176FF",
                            },
                            image: {
                                type: ControlType.ResponsiveImage,
                                title: "Image",
                            },
                            imageFit: {
                                type: ControlType.Enum,
                                title: "Image Fit",
                                options: ["cover", "contain", "fill", "none"],
                                optionTitles: [
                                    "Cover",
                                    "Contain",
                                    "Fill",
                                    "None",
                                ],
                                defaultValue: "cover",
                            },
                            link: {
                                type: ControlType.Link,
                                title: "Slide Link",
                                defaultValue: "",
                            },
                        },
                    },
                },
                mobileChildren: {
                    type: ControlType.Array,
                    title: "Sub-links (mobile)",
                    maxCount: 8,
                    description:
                        "Optional nested links under this row in the mobile drawer.",
                    control: {
                        type: ControlType.Object,
                        controls: {
                            title: {
                                type: ControlType.String,
                                title: "Title",
                                defaultValue: "Nested link",
                            },
                            link: {
                                type: ControlType.Link,
                                title: "Link",
                                defaultValue: "",
                            },
                        },
                    },
                },
            },
        },
    },

    mobileOnlyItems: {
        type: ControlType.Array,
        title: "⑦ Mobile-only links",
        maxCount: MAX_ITEMS,
        description:
            "Extra rows that only show in the mobile drawer (not in desktop Primary links).",
        control: {
            type: ControlType.Object,
            controls: {
                title: {
                    type: ControlType.String,
                    title: "Label",
                    defaultValue: "Mobile link",
                },
                description: {
                    type: ControlType.String,
                    title: "Description",
                    defaultValue: "",
                },
                icon: {
                    type: ControlType.ResponsiveImage,
                    title: "Icon",
                },
                link: {
                    type: ControlType.Link,
                    title: "Link URL",
                    defaultValue: "",
                },
                mobileChildren: {
                    type: ControlType.Array,
                    title: "Sub-links",
                    maxCount: 8,
                    control: {
                        type: ControlType.Object,
                        controls: {
                            title: {
                                type: ControlType.String,
                                title: "Title",
                                defaultValue: "Nested link",
                            },
                            link: {
                                type: ControlType.Link,
                                title: "Link",
                                defaultValue: "",
                            },
                        },
                    },
                },
            },
        },
    },

    colors: {
        type: ControlType.Object,
        title: "⑩ Colors",
        description: "All colors in one place, grouped by section.",
        controls: {
            trigger: {
                type: ControlType.Object,
                title: "Menu button",
                controls: {
                    bg: {
                        type: ControlType.Color,
                        title: "Background",
                        defaultValue: "rgba(255,255,255,0.08)",
                    },
                    openBg: {
                        type: ControlType.Color,
                        title: "Open BG",
                        defaultValue: "rgba(255,255,255,0.18)",
                    },
                    text: {
                        type: ControlType.Color,
                        title: "Text",
                        defaultValue: "#FFFFFF",
                    },
                    openText: {
                        type: ControlType.Color,
                        title: "Open Text",
                        defaultValue: "#FFFFFF",
                    },
                },
            },
            menu: {
                type: ControlType.Object,
                title: "Mega menu",
                controls: {
                    bg: {
                        type: ControlType.Color,
                        title: "Background",
                        defaultValue: "rgba(10,10,14,0.72)",
                    },
                    border: {
                        type: ControlType.Color,
                        title: "Border",
                        defaultValue: "rgba(255,255,255,0.14)",
                    },
                },
            },
            links: {
                type: ControlType.Object,
                title: "Primary links",
                controls: {
                    title: {
                        type: ControlType.Color,
                        title: "Title",
                        defaultValue: "rgba(255,255,255,0.92)",
                    },
                    description: {
                        type: ControlType.Color,
                        title: "Description",
                        defaultValue: "rgba(255,255,255,0.60)",
                    },
                    icon: {
                        type: ControlType.Color,
                        title: "Icon",
                        defaultValue: "rgba(255,255,255,0.80)",
                    },
                    hoverTitle: {
                        type: ControlType.Color,
                        title: "Hover Title",
                        defaultValue: "#FFFFFF",
                    },
                    hoverDescription: {
                        type: ControlType.Color,
                        title: "Hover Description",
                        defaultValue: "rgba(255,255,255,0.80)",
                    },
                    hoverIcon: {
                        type: ControlType.Color,
                        title: "Hover Icon",
                        defaultValue: "#FFFFFF",
                    },
                    hoverRowBg: {
                        type: ControlType.Color,
                        title: "Hover Row BG",
                        defaultValue: "rgba(255,255,255,0.08)",
                    },
                    activeRowBg: {
                        type: ControlType.Color,
                        title: "Active Row BG",
                        defaultValue: "rgba(255,255,255,0.10)",
                    },
                },
            },
            showcase: {
                type: ControlType.Object,
                title: "Showcase",
                controls: {
                    headline: {
                        type: ControlType.Color,
                        title: "Headline",
                        defaultValue: "#FFFFFF",
                    },
                    subhead: {
                        type: ControlType.Color,
                        title: "Subhead",
                        defaultValue: "rgba(255,255,255,0.85)",
                    },
                },
            },
            slides: {
                type: ControlType.Object,
                title: "Slides",
                controls: {
                    title: {
                        type: ControlType.Color,
                        title: "Title",
                        defaultValue: "#FFFFFF",
                    },
                    caption: {
                        type: ControlType.Color,
                        title: "Caption",
                        defaultValue: "rgba(255,255,255,0.85)",
                    },
                },
            },
            mobile: {
                type: ControlType.Object,
                title: "Mobile drawer",
                controls: {
                    bg: {
                        type: ControlType.Color,
                        title: "Background",
                        defaultValue: "rgba(18,18,24,0.98)",
                    },
                    border: {
                        type: ControlType.Color,
                        title: "Border",
                        defaultValue: "rgba(255,255,255,0.12)",
                    },
                    text: {
                        type: ControlType.Color,
                        title: "Text",
                        defaultValue: "#F2F2F4",
                    },
                    muted: {
                        type: ControlType.Color,
                        title: "Muted",
                        defaultValue: "rgba(242,242,244,0.72)",
                    },
                    icon: {
                        type: ControlType.Color,
                        title: "Icon",
                        defaultValue: "#F2F2F4",
                    },
                    rowHoverBg: {
                        type: ControlType.Color,
                        title: "Row Hover BG",
                        defaultValue: "rgba(255,255,255,0.08)",
                    },
                },
            },
        },
    },

    behavior: {
        type: ControlType.Object,
        title: "⑧ Interaction",
        description:
            "Open/close timing, focus, and which link is highlighted first.",
        controls: {
            openDelayMs: {
                type: ControlType.Number,
                title: "Open Delay (ms)",
                min: 0,
                max: 600,
                step: 10,
                defaultValue: 60,
                description:
                    "Delay before the panel opens after the cursor enters the trigger.",
            },
            closeDelayMs: {
                type: ControlType.Number,
                title: "Close Delay (ms)",
                min: 0,
                max: 1000,
                step: 10,
                defaultValue: 160,
                description:
                    "Delay before the panel closes after the cursor leaves.",
            },
            closeOnClick: {
                type: ControlType.Boolean,
                title: "Close on link click",
                defaultValue: true,
                description:
                    "Close the mega menu when someone clicks a link in Primary links.",
            },
            openOnFocus: {
                type: ControlType.Boolean,
                title: "Open on Focus",
                defaultValue: false,
                description:
                    "Open the panel when the trigger receives keyboard focus.",
            },
            initialSelection: {
                type: ControlType.Enum,
                title: "Initial Selection",
                options: ["None", "First"],
                optionTitles: [
                    "None — empty Showcase",
                    "First link highlighted",
                ],
                defaultValue: "First",
                description:
                    "Which link is highlighted when the mega menu first opens.",
            },
        },
    },

    mobile: {
        type: ControlType.Object,
        title: "⑨ Mobile drawer",
        description:
            "Drawer width, breakpoint, and list styling (layout mode is on Menu button).",
        controls: {
            breakpoint: {
                type: ControlType.Number,
                title: "Breakpoint",
                min: 320,
                max: 1440,
                step: 1,
                defaultValue: 900,
                hidden: (p: any) => readMobileLayout(p) !== "Auto",
            },
            width: {
                type: ControlType.Number,
                title: "Drawer Width",
                min: 220,
                max: 520,
                step: 1,
                defaultValue: 320,
                hidden: (p: any) => readMobileLayout(p) === "DesktopOnly",
            },
            showHamburger: {
                type: ControlType.Boolean,
                title: "Hamburger",
                defaultValue: true,
                hidden: (p: any) => readMobileLayout(p) === "DesktopOnly",
            },
            hamburgerIcon: {
                type: ControlType.ResponsiveImage,
                title: "Hamburger Icon",
                hidden: (p: any) =>
                    readMobileLayout(p) === "DesktopOnly" ||
                    !p.mobile?.showHamburger,
            },
            hamburgerSize: {
                type: ControlType.Number,
                title: "Hamburger Size",
                min: 12,
                max: 40,
                step: 1,
                defaultValue: 18,
                hidden: (p: any) =>
                    readMobileLayout(p) === "DesktopOnly" ||
                    !p.mobile?.showHamburger,
            },
            showIcons: {
                type: ControlType.Boolean,
                title: "Show Icons",
                defaultValue: true,
                hidden: (p: any) => readMobileLayout(p) === "DesktopOnly",
            },
            showDescriptions: {
                type: ControlType.Boolean,
                title: "Show Desc",
                defaultValue: true,
                hidden: (p: any) => readMobileLayout(p) === "DesktopOnly",
            },
            iconColor: {
                type: ControlType.Color,
                title: "Icon Color",
                defaultValue: "#F2F2F4",
                hidden: (p: any) => readMobileLayout(p) === "DesktopOnly",
            },
            bg: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "rgba(18,18,24,0.98)",
                hidden: () => true,
            },
            borderColor: {
                type: ControlType.Color,
                title: "Border Color",
                defaultValue: "rgba(255,255,255,0.12)",
                hidden: () => true,
            },
            borderWidth: {
                type: ControlType.Number,
                title: "Border Width",
                min: 0,
                max: 4,
                step: 1,
                defaultValue: 1,
                hidden: (p: any) => readMobileLayout(p) === "DesktopOnly",
            },
            textColor: {
                type: ControlType.Color,
                title: "Text Color",
                defaultValue: "#F2F2F4",
                hidden: () => true,
            },
            mutedColor: {
                type: ControlType.Color,
                title: "Muted Color",
                defaultValue: "rgba(242,242,244,0.72)",
                hidden: () => true,
            },
            itemGap: {
                type: ControlType.Number,
                title: "Link gap",
                min: 0,
                max: 40,
                step: 1,
                defaultValue: 4,
                hidden: (p: any) => readMobileLayout(p) === "DesktopOnly",
            },
            rowHoverBg: {
                type: ControlType.Color,
                title: "Row Hover",
                defaultValue: "rgba(255,255,255,0.08)",
                hidden: () => true,
            },
            shadow: {
                type: ControlType.BoxShadow,
                title: "Shadow",
                defaultValue: "0 24px 48px rgba(0,0,0,0.35)",
                hidden: (p: any) => readMobileLayout(p) === "DesktopOnly",
            },
        },
    },

    navbar: {
        type: ControlType.Object,
        title: "Navbar",
        description: "Full-width navigation bar settings.",
        controls: {
            height: {
                type: ControlType.Number,
                title: "Height",
                min: 40,
                max: 120,
                step: 1,
                defaultValue: 64,
            },
            paddingX: {
                type: ControlType.Number,
                title: "Side Padding",
                min: 0,
                max: 80,
                step: 4,
                defaultValue: 24,
            },
            bg: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "rgba(10,10,14,0.95)",
            },
            borderColor: {
                type: ControlType.Color,
                title: "Border Color",
                defaultValue: "rgba(255,255,255,0.1)",
            },
            borderWidth: {
                type: ControlType.Number,
                title: "Border Width",
                min: 0,
                max: 4,
                step: 1,
                defaultValue: 1,
            },
        },
    },

    logo: {
        type: ControlType.ResponsiveImage,
        title: "Logo",
        description: "Logo displayed on the left side of the navbar.",
    },

    logoWidth: {
        type: ControlType.Number,
        title: "Logo Width",
        min: 60,
        max: 300,
        step: 10,
        defaultValue: 120,
    },

    logoLink: {
        type: ControlType.Link,
        title: "Logo Link",
        defaultValue: "/",
    },

    showLogin: {
        type: ControlType.Boolean,
        title: "Show Login",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },

    loginLabel: {
        type: ControlType.String,
        title: "Login Label",
        defaultValue: "Login",
        hidden: (p) => !p.showLogin,
    },

    loginLink: {
        type: ControlType.Link,
        title: "Login Link",
        defaultValue: "/login",
        hidden: (p) => !p.showLogin,
    },

    loginIcon: {
        type: ControlType.ResponsiveImage,
        title: "Login Icon",
        description: "Custom login icon. Leave empty for default user icon.",
        hidden: (p) => !p.showLogin,
    },

    logoText: {
        type: ControlType.String,
        title: "Logo Text",
        defaultValue: "Brand",
    },

    showGetStarted: {
        type: ControlType.Boolean,
        title: "Show Get Started",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },

    getStartedLabel: {
        type: ControlType.String,
        title: "Get Started Label",
        defaultValue: "Get started",
        hidden: (p) => !p.showGetStarted,
    },

    getStartedLink: {
        type: ControlType.Link,
        title: "Get Started Link",
        defaultValue: "",
        hidden: (p) => !p.showGetStarted,
    },

    showRefreshIcon: {
        type: ControlType.Boolean,
        title: "Show Refresh Icon",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },

    refreshIcon: {
        type: ControlType.ResponsiveImage,
        title: "Refresh Icon",
        description: "Custom refresh icon. Leave empty for default.",
        hidden: (p) => !p.showRefreshIcon,
    },

    refreshLink: {
        type: ControlType.Link,
        title: "Refresh Link",
        defaultValue: "",
        hidden: (p) => !p.showRefreshIcon,
    },
})
