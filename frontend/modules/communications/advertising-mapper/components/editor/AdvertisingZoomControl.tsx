"use client";

import type { CSSProperties } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  scalePercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  className?: string;
  style?: CSSProperties;
};

/** Top-left zoom chip — wheel zoom is disabled; use buttons or Ctrl+scroll on canvas. */
export function AdvertisingZoomControl({ scalePercent, onZoomIn, onZoomOut, className, style }: Props) {
  return (
    <div
      style={style}
      className={cn(
        "pointer-events-auto flex flex-col gap-1 rounded-lg border border-slate-200/90 bg-white/95 p-1 shadow-md backdrop-blur-sm",
        className,
      )}
      role="group"
      aria-label="Zoom"
    >
      <div className="flex items-center rounded-md border border-slate-200/80 bg-slate-50/80">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-white"
          onClick={onZoomOut}
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-[3.25rem] border-x border-slate-200/80 px-2 text-center font-mono text-xs font-semibold text-slate-800">
          {scalePercent}%
        </span>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-white"
          onClick={onZoomIn}
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className="px-1 text-center text-[9px] leading-tight text-slate-400">Ctrl + scroll to zoom</p>
    </div>
  );
}
