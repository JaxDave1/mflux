import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#7C8CFF",
        secondary: "#00D4C8",
        tertiary: "#FFB454",
        background: "#001F3F",
        surface: "#002B55",
        "surface-dim": "#001428",
        "surface-bright": "#00335f",
        "surface-variant": "#002B55",
        "surface-container-lowest": "#001428",
        "surface-container-low": "#001A36",
        "surface-container": "#00244A",
        "surface-container-high": "#002B55",
        "surface-container-highest": "#00335F",
        "on-background": "#FFFFFF",
        "on-surface": "#FFFFFF",
        "on-surface-variant": "#A0B4D0",
        "on-primary": "#001428",
        "on-secondary": "#001a1a",
        "on-tertiary": "#241500",
        outline: "#B8C9E0",
        "outline-variant": "#B8C9E0",
        error: "#FF4D6B",
        "error-container": "#3d0f18",
        "on-error": "#1a0000",
        "on-error-container": "#ffb8c4",
        "metallic": "#B8C9E0",
        "metal-titanium-light": "#B8C9E0",
        "metal-chrome": "#FFFFFF"
      },
      fontFamily: {
        headline: ["Rajdhani", "Eurostile", "system-ui", "sans-serif"],
        body: ["IBM Plex Sans", "Inter", "-apple-system", "sans-serif"],
        label: ["Rajdhani", "Eurostile", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"]
      },
      width: {
        rail: "72px"
      },
      height: {
        status: "56px"
      },
      boxShadow: {
        "glow-primary": "0 0 12px rgba(124, 140, 255, 0.24)",
        "glow-secondary": "0 0 12px rgba(0, 212, 200, 0.24)",
        "glow-secondary-lg": "0 0 16px rgba(0, 212, 200, 0.4)",
        "inner-primary": "inset 0 0 12px rgba(124, 140, 255, 0.12)",
        "inner-secondary": "inset 0 0 12px rgba(0, 212, 200, 0.12)"
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(1.18)" }
        }
      },
      animation: {
        "pulse-dot": "pulseDot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
      },
      borderRadius: {
        panel: "0.75rem"
      }
    }
  },
  plugins: []
} satisfies Config;
