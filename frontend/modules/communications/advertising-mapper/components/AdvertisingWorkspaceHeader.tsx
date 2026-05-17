"use client";

import { Save } from "lucide-react";
import type { MeasurementUnit } from "@/modules/communications/advertising-mapper/types";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type Props = {
  unit: MeasurementUnit;
  onUnitChange: (u: MeasurementUnit) => void;
};

export function AdvertisingWorkspaceHeader({ unit, onUnitChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border border-ds-border bg-ds-secondary/40 p-0.5">
        {(["ft", "in"] as const).map((u) => (
          <button
            key={u}
            type="button"
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-bold uppercase",
              unit === u ? "bg-ds-primary text-ds-foreground shadow-sm" : "text-ds-muted hover:text-ds-foreground",
            )}
            onClick={() => onUnitChange(u)}
          >
            {u}
          </button>
        ))}
      </div>
      <button type="button" className={cn(buttonVariants({ intent: "primary", surface: "light" }), "gap-1.5 px-3 py-1.5 text-xs")}>
        <Save className="h-3.5 w-3.5" />
        Save
      </button>
    </div>
  );
}
