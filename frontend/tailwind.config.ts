import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        headline: ["var(--font-app)", "system-ui", "sans-serif"],
        body: ["var(--font-app)", "system-ui", "sans-serif"],
        /** Navbar “panorama pulse” — set in root layout via `next/font` */
        panoramaBrand: ["var(--font-panorama-brand)", "Poppins", "system-ui", "sans-serif"],
      },
      colors: {
        helix: {
          bg: "#f8f9fa",
          surface: "#f3f4f5",
          surfaceLow: "#edeeef",
          primary: "#30568b",
          "primary-dim": "#4a6fa5",
          onSurface: "#191c1d",
          onSurfaceVariant: "#43474f",
          tertiary: "#705000",
          outline: "#c3c6d1",
        },
        pulse: {
          bg: "#f7f8fa",
          accent: "var(--ds-accent)",
          "accent-hover": "#248a7d",
          navy: "#2c3a55",
          muted: "#64748b",
          border: "#e2e8f0",
        },
        /** Stealth Pro — ops dashboard dark shell (calm SaaS, minimal accent). */
        stealth: {
          main: "#0B0F14",
          card: "#121821",
          border: "#1F2937",
          primary: "#E5E7EB",
          secondary: "#9CA3AF",
          muted: "#6B7280",
          accent: "#3B82F6",
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
        },
        /** Schedule + app chrome — maps to CSS variables in globals.css */
        pulseShell: {
          canvas: "var(--pulse-shell-canvas)",
          surface: "var(--pulse-shell-surface)",
          elevated: "var(--pulse-shell-elevated)",
          cell: "var(--pulse-shell-cell)",
          "cell-muted": "var(--pulse-shell-cell-muted)",
          "header-row": "var(--pulse-shell-header-row)",
          border: "var(--pulse-shell-border)",
          grid: "var(--pulse-shell-grid)",
          kbd: "var(--pulse-shell-kbd)",
        },
        /** App shell — maps to CSS variables (see `globals.css`) */
        background: "var(--ds-bg)",
        foreground: "var(--ds-text-primary)",
        border: "var(--ds-border)",
        muted: {
          DEFAULT: "var(--ds-surface-secondary)",
          foreground: "var(--ds-text-secondary)",
        },
        /** Unified design system — prefer these for new UI */
        ds: {
          bg: "var(--ds-bg)",
          foreground: "var(--ds-text-primary)",
          muted: "var(--ds-text-secondary)",
          border: "var(--ds-border)",
          primary: "var(--ds-surface-primary)",
          secondary: "var(--ds-surface-secondary)",
          elevated: "var(--ds-surface-elevated)",
          sidebar: "var(--ds-sidebar)",
          "sidebar-fg": "var(--ds-sidebar-fg)",
          "sidebar-muted": "var(--ds-sidebar-muted)",
          "sidebar-border": "var(--ds-sidebar-border)",
          "sidebar-well": "var(--ds-sidebar-well)",
          "sidebar-well-muted": "var(--ds-sidebar-well-muted)",
          "sidebar-hover": "var(--ds-sidebar-interactive-hover)",
          "sidebar-hover-strong": "var(--ds-sidebar-interactive-hover-strong)",
          header: "var(--ds-header)",
          accent: "var(--ds-accent)",
          "accent-foreground": "var(--ds-accent-foreground)",
          "interactive-hover": "var(--ds-interactive-hover)",
          success: "var(--ds-success)",
          warning: "var(--ds-warning)",
          danger: "var(--ds-danger)",
          /** Text on solid brand / status fills */
          "on-accent": "var(--ds-on-accent)",
          /** Gantt / CPM task category bars */
          blue: { 500: "#0ea5e9" },
          teal: { 500: "var(--ds-accent)" },
          yellow: { 500: "#eab308" },
          pink: { 500: "#ec4899" },
          gray: { 400: "#9ca3af" },
        },
      },
      ringOffsetColor: {
        "pulse-shell-cell": "var(--pulse-shell-cell)",
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 2px 10px rgb(0 0 0 / 0.06)",
        "card-lg": "0 2px 12px rgb(0 0 0 / 0.07), 0 4px 18px rgba(48, 86, 139, 0.05)",
        helix: "0 2px 12px rgb(0 0 0 / 0.06), 0 4px 18px rgba(48, 86, 139, 0.05)",
        "stealth-card": "0 1px 3px rgba(0, 0, 0, 0.22), 0 2px 10px rgba(0, 0, 0, 0.18)",
      },
      keyframes: {
        "welcome-ocean": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "welcome-ocean": "welcome-ocean 4.25s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
