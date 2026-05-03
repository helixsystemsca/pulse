import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Kiosk | Pulse" },
  robots: { index: false, follow: false },
};

/** Minimal shell — no app chrome; kiosk pages render full-bleed. */
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return children;
}
