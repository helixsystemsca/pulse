"use client";

import type { ReactNode } from "react";
import { ChevronDown, Maximize2 } from "lucide-react";
import type { MeasurementUnit } from "@/modules/communications/advertising-mapper/types";
import { AdvertisingViewportTitle } from "@/modules/communications/advertising-mapper/components/editor/AdvertisingViewportTitle";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

export type AdvertisingEditorHeaderBarProps = {
  workspaceSwitcher?: ReactNode;
  wallName: string;
  onWallRename: (name: string) => void;
  inventoryTotal: number;
  inventoryAvailable: number;
  inventoryOccupied: number;
  unit: MeasurementUnit;
  onUnitChange: (unit: MeasurementUnit) => void;
  onSave?: () => void;
  onPublish?: () => void;
  fullscreenHref?: string;
};

/** Single-line global header (~52px) — module tabs, context, inline metrics. */
export function AdvertisingEditorHeaderBar({
  workspaceSwitcher,
  wallName,
  onWallRename,
  inventoryTotal,
  inventoryAvailable,
  inventoryOccupied,
  unit,
  onUnitChange,
  onSave,
  onPublish,
  fullscreenHref,
}: AdvertisingEditorHeaderBarProps) {
  return (
    <header className="grid h-[52px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-slate-200/80 bg-white/95 px-3 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2 justify-self-start">{workspaceSwitcher}</div>

      <div className="flex min-w-0 items-center justify-center gap-2 justify-self-center">
        <span className="shrink-0 text-sm font-medium text-slate-500">Advertising</span>
        <span className="shrink-0 text-slate-300" aria-hidden>
          /
        </span>
        <AdvertisingViewportTitle name={wallName} variant="breadcrumb" onRename={onWallRename} />
      </div>

      <div className="flex min-w-0 items-center justify-end gap-3 justify-self-end">
        <p className="hidden items-center gap-2 text-xs text-slate-600 sm:flex" aria-label="Inventory summary">
          <Metric value={inventoryTotal} label="inv" />
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <Metric value={inventoryAvailable} label="avail" />
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <Metric value={inventoryOccupied} label="occ" />
        </p>

        <div className="flex items-center gap-1.5">
          <div className="flex rounded-md border border-slate-200/90 bg-slate-50/80 p-0.5 text-[11px] font-semibold">
            {(["ft", "in"] as const).map((u) => (
              <button
                key={u}
                type="button"
                className={cn(
                  "rounded px-2 py-0.5 capitalize",
                  unit === u ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
                )}
                onClick={() => onUnitChange(u)}
              >
                {u}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={cn(buttonVariants({ intent: "secondary", surface: "light" }), "h-7 px-2.5 text-[11px]")}
            onClick={onSave}
          >
            Save
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ intent: "primary", surface: "light" }), "h-7 gap-0.5 px-2.5 text-[11px]")}
            onClick={onPublish}
          >
            Publish
            <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />
          </button>
          {fullscreenHref ? (
            <a
              href={fullscreenHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ intent: "secondary", surface: "light" }),
                "inline-flex h-7 w-7 items-center justify-center p-0",
              )}
              aria-label="Open fullscreen editor"
              title="Fullscreen"
            >
              <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <span className="tabular-nums">
      <span className="font-semibold text-slate-800">{value}</span>{" "}
      <span className="text-slate-500">{label}</span>
    </span>
  );
}
