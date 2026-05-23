"use client";

import { Plus } from "lucide-react";
import type { FacilityWallPlan } from "@/modules/communications/advertising-mapper/types";
import { cn } from "@/lib/cn";

type Props = {
  walls: readonly FacilityWallPlan[];
  activeWallId: string;
  onWallChange: (id: string) => void;
  onAddWall: () => void;
};

/** Compact viewport tabs for the editor status bar. */
export function AdvertisingViewportSwitcher({ walls, activeWallId, onWallChange, onAddWall }: Props) {
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:thin]">
      {walls.map((wall) => {
        const selected = wall.id === activeWallId;
        return (
          <button
            key={wall.id}
            type="button"
            onClick={() => onWallChange(wall.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
              selected
                ? "bg-sky-100/90 text-sky-800 ring-1 ring-sky-200/80"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
            )}
            title={wall.name}
          >
            <MiniThumb wall={wall} />
            <span className="max-w-[5rem] truncate">{wall.name}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAddWall}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300/90 text-slate-500 hover:border-sky-400 hover:bg-sky-50/80 hover:text-sky-700"
        aria-label="Add viewport"
        title="Add viewport"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

function MiniThumb({ wall }: { wall: FacilityWallPlan }) {
  const hasPhoto = Boolean(wall.backdropUrl);
  return (
    <span className="relative block h-5 w-7 overflow-hidden rounded border border-slate-200/80 bg-slate-200">
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={wall.backdropUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="block h-full w-full bg-gradient-to-b from-slate-300 to-slate-400" />
      )}
    </span>
  );
}
