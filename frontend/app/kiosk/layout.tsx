import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { template: "%s | Panorama", default: "Kiosk" },
  icons: {
    icon: [{ url: "/images/favicon.png", type: "image/png" }],
    apple: [{ url: "/images/favicon.png", type: "image/png" }],
  },
  robots: { index: false, follow: false },
};

/** Minimal shell — no app chrome; kiosk pages render full-bleed. */
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return children;
}
