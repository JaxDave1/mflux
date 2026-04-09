import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#ff2d78",
        secondary: "#00ffcc",
        tertiary: "#ffe04a",
        background: "#0a0a12",
        surface: "#0f0f1a",
        "surface-dim": "#0f0f1a",
        "surface-bright": "#1a1a2e",
        "surface-variant": "#1e1e30",
        "surface-container-lowest": "#0a0a12",
        "surface-container-low": "#111118",
        "surface-container": "#141422",
        "surface-container-high": "#1e1e30",
        "surface-container-highest": "#28283e",
        "on-background": "#e8e0f0",
        "on-surface": "#e8e0f0",
        "on-surface-variant": "#a098b0",
        "on-primary": "#1a0010",
        "on-secondary": "#001a1a",
        "on-tertiary": "#1a1000",
        outline: "#5a5068",
        "outline-variant": "#302840",
        error: "#ff4444",
        "error-container": "#3d0f0f",
        "on-error": "#1a0000",
        "on-error-container": "#ffa0a0"
      },
      fontFamily: {
        headline: ["Sora", "sans-serif"],
        body: ["Inter", "sans-serif"],
        label: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      width: {
        rail: "72px"
      },
      height: {
        status: "56px"
      },
      boxShadow: {
        "glow-primary": "0 0 12px rgba(255, 45, 120, 0.24)",
        "glow-secondary": "0 0 12px rgba(0, 255, 204, 0.24)",
        "glow-secondary-lg": "0 0 16px rgba(0, 255, 204, 0.4)",
        "inner-primary": "inset 0 0 12px rgba(255, 45, 120, 0.12)",
        "inner-secondary": "inset 0 0 12px rgba(0, 255, 204, 0.12)"
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
