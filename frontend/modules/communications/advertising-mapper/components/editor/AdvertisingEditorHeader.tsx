"use client";

import { ChevronDown } from "lucide-react";
import type { MeasurementUnit } from "@/modules/communications/advertising-mapper/types";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type Props = {
  unit: MeasurementUnit;
  onUnitChange: (unit: MeasurementUnit) => void;
  onSave?: () => void;
  onPublish?: () => void;
};

export function AdvertisingEditorHeader({ unit, onUnitChange, onSave, onPublish }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
        {(["ft", "in"] as const).map((u) => (
          <button
            key={u}
            type="button"
            className={cn(
              "rounded-md px-2.5 py-1 capitalize",
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
        className={cn(buttonVariants({ intent: "secondary", surface: "light" }), "h-8 px-3 text-xs")}
        onClick={onSave}
      >
        Save
      </button>
      <button
        type="button"
        className={cn(buttonVariants({ intent: "primary", surface: "light" }), "h-8 gap-1 px-3 text-xs")}
        onClick={onPublish}
      >
        Publish Layout
        <ChevronDown className="h-3.5 w-3.5 opacity-80" />
      </button>
    </div>
  );
}
