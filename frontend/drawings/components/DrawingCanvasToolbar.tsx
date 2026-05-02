"use client";

import { HelpCircle, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useState, type RefObject } from "react";

import { cn } from "@/lib/cn";
import type { BlueprintViewportHandle } from "@/components/zones-devices/BlueprintReadOnlyCanvas";

const railBtn =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ds-border/70 bg-background/95 text-ds-foreground shadow-sm transition-colors hover:bg-ds-primary/40 disabled:cursor-not-allowed disabled:opacity-40";

export function DrawingCanvasToolbar({
  disabled,
  viewportRef,
}: {
  disabled: boolean;
  viewportRef: RefObject<BlueprintViewportHandle | null>;
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div
      className="pointer-events-auto absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1.5 rounded-xl border border-ds-border/60 bg-ds-primary/90 p-1.5 shadow-md backdrop-blur-sm"
      role="toolbar"
      aria-label="Map view tools"
    >
      <button
        type="button"
        title="Zoom in"
        disabled={disabled}
        className={railBtn}
        onClick={() => viewportRef.current?.zoomIn()}
      >
        <ZoomIn className="h-5 w-5 shrink-0" aria-hidden />
      </button>
      <button
        type="button"
        title="Zoom out"
        disabled={disabled}
        className={railBtn}
        onClick={() => viewportRef.current?.zoomOut()}
      >
        <ZoomOut className="h-5 w-5 shrink-0" aria-hidden />
      </button>
      <button
        type="button"
        title="Fit map to view"
        disabled={disabled}
        className={railBtn}
        onClick={() => viewportRef.current?.resetFit()}
      >
        <Maximize2 className="h-5 w-5 shrink-0" aria-hidden />
      </button>
      <div className="my-0.5 h-px w-full bg-ds-border/50" aria-hidden />
      <button
        type="button"
        title="How this map works"
        className={cn(railBtn, helpOpen && "border-ds-success/60 bg-ds-success/10")}
        aria-expanded={helpOpen}
        onClick={() => setHelpOpen((v) => !v)}
      >
        <HelpCircle className="h-5 w-5 shrink-0" aria-hidden />
      </button>
      {helpOpen ? (
        <div className="max-w-[220px] rounded-lg border border-ds-border/60 bg-background/98 p-2 text-[10px] leading-snug text-ds-muted shadow-sm">
          <p className="font-semibold text-ds-foreground">Typical workflow</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-3.5">
            <li>Pick a project and map in the header; upload an image if needed.</li>
            <li>
              Use <strong className="text-ds-foreground">Select</strong> or <strong className="text-ds-foreground">Pan</strong> on the left rail; zoom controls stay here on the right.
            </li>
            <li>
              <strong className="text-ds-foreground">Add asset</strong> (left rail): draw a rectangle, ellipse, or polygon footprint — creates a device/junction on the graph.
            </li>
            <li>
              <strong className="text-ds-foreground">Connect</strong>: draw a line between two assets (or use pick mode in the side panel) for wiring/piping links.
            </li>
            <li>
              <strong className="text-ds-foreground">Zone</strong>: draw a closed polygon for a building area / zone (blueprint overlay).
            </li>
            <li>
              <strong className="text-ds-foreground">Select</strong>, then click an asset, connection, or zone — edit name, notes, and attributes in the right panel.
            </li>
          </ol>
        </div>
      ) : null}
    </div>
  );
}
