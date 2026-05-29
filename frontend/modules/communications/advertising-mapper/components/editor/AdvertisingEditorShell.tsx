"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

import { ADVERTISING_WORKSPACE } from "@/spatial-engine/workspace/definitions/advertising";

export const AD_EDITOR_HEADER_PX = 52;
export const AD_EDITOR_FOOTER_PX = 40;
/** Fixed inspector width — matches `ADVERTISING_WORKSPACE.layout.rightPanelWidthPx`. */
export const AD_EDITOR_INSPECTOR_RAIL_PX = ADVERTISING_WORKSPACE.layout?.rightPanelWidthPx ?? 380;
export const AD_EDITOR_INSPECTOR_RAIL = `${AD_EDITOR_INSPECTOR_RAIL_PX}px`;
/** Left rail for arena surface slides (Left, Center, Right, …). */
export const AD_EDITOR_SURFACE_RAIL_PX = ADVERTISING_WORKSPACE.layout?.leftPanelWidthPx ?? 96;
export const AD_EDITOR_SURFACE_RAIL = `${AD_EDITOR_SURFACE_RAIL_PX}px`;

export type AdvertisingEditorShellProps = {
  header: ReactNode;
  viewport: ReactNode;
  inspector: ReactNode;
  footer: ReactNode;
  /** Vertical surface switcher — Left / Center / Right / Scoreboard, etc. */
  surfaceRail?: ReactNode;
  floatingToolbar?: ReactNode;
  floatingToolbarTop?: number;
  minimap?: ReactNode;
  fullscreen?: boolean;
  immersive?: boolean;
  className?: string;
};

/**
 * Arena editor — surface rail (left) · canvas · context inspector (right).
 */
export function AdvertisingEditorShell({
  header,
  viewport,
  inspector,
  footer,
  surfaceRail,
  floatingToolbar,
  floatingToolbarTop = 56,
  minimap,
  fullscreen = false,
  immersive = true,
  className,
}: AdvertisingEditorShellProps) {
  const hasSurfaceRail = Boolean(surfaceRail);
  const columns = hasSurfaceRail
    ? `${AD_EDITOR_SURFACE_RAIL} minmax(0, 1fr) ${AD_EDITOR_INSPECTOR_RAIL}`
    : `minmax(0, 1fr) ${AD_EDITOR_INSPECTOR_RAIL}`;
  const areas = hasSurfaceRail
    ? `
          "header header header"
          "surfaces canvas inspector"
          "footer footer footer"
        `
    : `
          "header header"
          "canvas inspector"
          "footer footer"
        `;

  return (
    <div
      className={cn(
        "grid h-full min-h-0 w-full overflow-hidden bg-[#e8ecf1] font-manrope",
        immersive && !fullscreen && "min-h-0 flex-1",
        fullscreen && "h-[100dvh]",
        className,
      )}
      style={{
        gridTemplateRows: `${AD_EDITOR_HEADER_PX}px minmax(0, 1fr) ${AD_EDITOR_FOOTER_PX}px`,
        gridTemplateColumns: columns,
        gridTemplateAreas: areas,
      }}
    >
      <div className="min-h-0 overflow-hidden" style={{ gridArea: "header" }}>
        {header}
      </div>

      {hasSurfaceRail ? (
        <aside
          className="flex min-h-0 flex-col overflow-hidden border-r border-slate-200/80 bg-[#f1f5f9]"
          style={{ gridArea: "surfaces" }}
        >
          {surfaceRail}
        </aside>
      ) : null}

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
          <div className="pointer-events-none absolute bottom-3 right-3 z-30" aria-hidden={false}>
            {minimap}
          </div>
        ) : null}
      </main>

      <aside
        className="flex h-full min-h-0 flex-col overflow-hidden border-l border-slate-200/80 bg-[#dce3eb]"
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
