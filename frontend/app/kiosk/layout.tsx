import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { template: "%s | Panorama", default: "Kiosk" },
  icons: {
    icon: [{ url: "/images/panoramalogo2.png", type: "image/png" }],
    apple: [{ url: "/images/panoramalogo2.png", type: "image/png" }],
  },
  robots: { index: false, follow: false },
};

/**
 * Minimal shell — no app chrome. Fills the viewport so the body does not scroll; each kiosk page
 * owns internal scrolling (e.g. dashboard grid) when content exceeds one screen.
 */
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-ds-bg text-ds-foreground">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
