"use client";

import { useEffect } from "react";
import { KIOSK_PRESENTATION_CLASS, kioskRefreshIntervalMs } from "@/lib/dashboards/kiosk";

type Props = {
  children: React.ReactNode;
  /** Show a minimal footer with last refresh time. */
  showRefreshHint?: boolean;
};

/**
 * Fullscreen kiosk wrapper: viewport-locked layout, monitor-friendly scaling, periodic soft reload.
 */
export function KioskDisplayShell({ children, showRefreshHint = true }: Props) {
  useEffect(() => {
    const ms = kioskRefreshIntervalMs();
    const id = window.setInterval(() => {
      window.location.reload();
    }, ms);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className={`${KIOSK_PRESENTATION_CLASS} flex min-h-0 flex-1 flex-col overflow-hidden`}
      data-kiosk-display
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden [font-size:clamp(13px,0.95vw,17px)]">
        {children}
      </div>
      {showRefreshHint ? (
        <footer className="shrink-0 border-t border-ds-border/40 px-4 py-1 text-center text-[10px] text-ds-muted">
          Kiosk display · auto-refreshes periodically
        </footer>
      ) : null}
    </div>
  );
}
