import type { Metadata } from "next";
import { KioskDisplayShell } from "@/components/kiosk/KioskDisplayShell";

export const metadata: Metadata = {
  title: { template: "%s | Helix", default: "Kiosk" },
  robots: { index: false, follow: false },
};

/**
 * Minimal shell — no app chrome. Fills the viewport so the body does not scroll. Operations
 * kiosk pages auto-advance the widget grid; other kiosks own any internal paging.
 */
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-ds-bg text-ds-foreground">
      <KioskDisplayShell>{children}</KioskDisplayShell>
    </div>
  );
}
