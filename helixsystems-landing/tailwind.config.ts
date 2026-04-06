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
        headline: ["var(--font-headline)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
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
          accent: "#2563eb",
          "accent-hover": "#1d4ed8",
          navy: "#0f172a",
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
      },
      boxShadow: {
        card: "0 4px 6px -1px rgb(0 0 0 / 0.06), 0 10px 24px -4px rgb(0 0 0 / 0.08)",
        "card-lg": "0 12px 32px rgba(48, 86, 139, 0.08)",
        helix: "0 12px 32px rgba(48, 86, 139, 0.08)",
        "stealth-card": "0 2px 8px rgba(0, 0, 0, 0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
