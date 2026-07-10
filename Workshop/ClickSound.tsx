// Audio-on-Click Overlay Button
// Replicates the attached image and follows Framer component rules. Plays an audio file when clicked, covering the entire area, and is visually clear in the canvas.
import { addPropertyControls, ControlType } from "framer"
import { useState, useRef, useEffect, startTransition } from "react"

/**
 * Audio-on-Click Overlay Button
 *
 * @framerIntrinsicWidth 360
 * @framerIntrinsicHeight 140
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function ClickSound(props) {
    const {
        audioFile = "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3",
        volume = 100,
        style,
        startAt = 0,
    } = props
    const [isPlaying, setIsPlaying] = useState(false)
    const audioRef = useRef(null)

    useEffect(() => {
        if (audioFile) {
            audioRef.current = new Audio(audioFile)
        }
    }, [audioFile])

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume / 100
        }
    }, [volume])

    const handleClick = (e) => {
        if (!audioFile) return
        if (!audioRef.current) {
            audioRef.current = new Audio(audioFile)
            audioRef.current.volume = volume / 100
        }
        audioRef.current.pause()
        audioRef.current.currentTime = (startAt || 0) / 1000
        audioRef.current.volume = volume / 100
        audioRef.current.onended = () => {
            startTransition(() => setIsPlaying(false))
        }
        audioRef.current.play()
        startTransition(() => setIsPlaying(true))
    }

    // Visual overlay for canvas, matches attached image
    return (
        <div
            style={{
                ...style,
                width: "100%",
                height: "100%",
                cursor: audioFile ? "pointer" : "default",
                background: "rgba(136, 85, 255, 0.1)",
                border: "1px dashed rgb(136, 85, 255)",
                borderRadius: 6,
                color: "rgb(136, 85, 255)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: 8,
                userSelect: "none",
            }}
            onMouseDown={handleClick}
            tabIndex={0}
            role="button"
            aria-label="Play audio on click"
        >
            <div
                style={{
                    fontSize: 12,
                    fontWeight: 500,
                    userSelect: "none",
                    marginBottom: 10,
                }}
            >
                🔈 {isPlaying ? "Playing" : "Click to Play"}
            </div>
            <div
                style={{
                    fontSize: 12,
                    opacity: 0.7,
                    maxWidth: 500,
                    textAlign: "center",
                    lineHeight: 1.5,
                }}
            >
                Place above button & set opacity to 0
            </div>
        </div>
    )
}

addPropertyControls(ClickSound, {
    audioFile: {
        type: ControlType.File,
        allowedFileTypes: ["mp3", "wav", "ogg"],
        title: "Audio File",
    },
    volume: {
        type: ControlType.Number,
        title: "Volume",
        min: 0,
        max: 100,
        defaultValue: 100,
        unit: "%",
        step: 1,
    },
    startAt: {
        type: ControlType.Number,
        title: "Start At (ms)",
        min: 0,
        max: 60000,
        defaultValue: 0,
        step: 10,
    },
})