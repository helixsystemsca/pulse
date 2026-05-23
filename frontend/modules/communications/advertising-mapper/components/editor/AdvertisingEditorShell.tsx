"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const AD_EDITOR_HEADER_PX = 52;
export const AD_EDITOR_FOOTER_PX = 38;

export type AdvertisingEditorShellProps = {
  header: ReactNode;
  footer: ReactNode;
  viewport: ReactNode;
  /** Centered glass toolbar — does not affect layout flow. */
  floatingToolbar?: ReactNode;
  floatingToolbarTop?: number;
  minimap?: ReactNode;
  /** Slide-over inventory / inspector (canvas stays full width). */
  inspector?: ReactNode;
  inspectorOpen?: boolean;
  inspectorWidthPx?: number;
  fullscreen?: boolean;
  immersive?: boolean;
  className?: string;
};

/**
 * Figma-style advertising workspace chrome — thin header, dominant canvas, status footer.
 */
export function AdvertisingEditorShell({
  header,
  footer,
  viewport,
  floatingToolbar,
  floatingToolbarTop = 56,
  minimap,
  inspector,
  inspectorOpen = false,
  inspectorWidthPx = 360,
  fullscreen = false,
  immersive = true,
  className,
}: AdvertisingEditorShellProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-col overflow-hidden bg-[#e8ecf1] font-manrope",
        immersive && !fullscreen && "h-[calc(100dvh-3.5rem)]",
        fullscreen && "h-[100dvh]",
        className,
      )}
    >
      {header}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <main className="relative min-h-0 flex-1 overflow-hidden">
          {floatingToolbar ? (
            <div
              className="pointer-events-none absolute left-1/2 z-40 -translate-x-1/2"
              style={{ top: floatingToolbarTop }}
            >
              {floatingToolbar}
            </div>
          ) : null}

          <div className="absolute inset-0">{viewport}</div>

          {minimap ? (
            <div
              className="pointer-events-none absolute left-3 z-30"
              style={{ bottom: AD_EDITOR_FOOTER_PX + 12 }}
            >
              {minimap}
            </div>
          ) : null}

          {inspector && inspectorOpen ? (
            <aside
              className="absolute inset-y-0 right-0 z-50 flex flex-col border-l border-slate-200/90 bg-white shadow-[-8px_0_32px_rgba(15,23,42,0.12)]"
              style={{ width: inspectorWidthPx }}
            >
              {inspector}
            </aside>
          ) : null}
        </main>

        {footer}
      </div>
    </div>
  );
}
