"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const AD_EDITOR_HEADER_PX = 52;
export const AD_EDITOR_FOOTER_PX = 40;
export const AD_EDITOR_INSPECTOR_RAIL = "clamp(268px, 17vw, 320px)";

export type AdvertisingEditorShellProps = {
  header: ReactNode;
  viewport: ReactNode;
  inspector: ReactNode;
  footer: ReactNode;
  floatingToolbar?: ReactNode;
  floatingToolbarTop?: number;
  minimap?: ReactNode;
  fullscreen?: boolean;
  immersive?: boolean;
  className?: string;
};

/**
 * Viewport-first editor — full-width canvas | thin inspector (no left scene rail).
 */
export function AdvertisingEditorShell({
  header,
  viewport,
  inspector,
  footer,
  floatingToolbar,
  floatingToolbarTop = 56,
  minimap,
  fullscreen = false,
  immersive = true,
  className,
}: AdvertisingEditorShellProps) {
  return (
    <div
      className={cn(
        "grid min-h-0 w-full overflow-hidden bg-[#e8ecf1] font-manrope",
        immersive && !fullscreen && "min-h-0 flex-1",
        fullscreen && "h-[100dvh]",
        className,
      )}
      style={{
        gridTemplateRows: `${AD_EDITOR_HEADER_PX}px minmax(0, 1fr) ${AD_EDITOR_FOOTER_PX}px`,
        gridTemplateColumns: `minmax(0, 1fr) ${AD_EDITOR_INSPECTOR_RAIL}`,
        gridTemplateAreas: `
          "header header"
          "canvas inspector"
          "footer footer"
        `,
      }}
    >
      <div className="min-h-0 overflow-hidden" style={{ gridArea: "header" }}>
        {header}
      </div>

      <main className="relative min-h-0 min-w-0 overflow-hidden bg-[#dce3eb]" style={{ gridArea: "canvas" }}>
        {floatingToolbar ? (
          <div
            className="pointer-events-none absolute left-1/2 z-40 -translate-x-1/2"
            style={{ top: floatingToolbarTop }}
          >
            {floatingToolbar}
          </div>
        ) : null}
        <div className="absolute inset-0 min-h-0">{viewport}</div>
        {minimap ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-30" aria-hidden={false}>
            {minimap}
          </div>
        ) : null}
      </main>

      <aside
        className="min-h-0 overflow-hidden border-l border-slate-200/80 bg-[#dce3eb]"
        style={{ gridArea: "inspector" }}
      >
        {inspector}
      </aside>

      <div className="min-h-0 overflow-hidden" style={{ gridArea: "footer" }}>
        {footer}
      </div>
    </div>
  );
}
