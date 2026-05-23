"use client";

import { useState } from "react";
import { ImagePlus, Plus } from "lucide-react";
import type { FacilityWallPlan } from "@/modules/communications/advertising-mapper/types";
import { WallBackdropStripControl } from "@/modules/communications/advertising-mapper/components/editor/WallBackdropStripControl";
import { cn } from "@/lib/cn";

type BackdropPatch = {
  backdropUrl?: string;
  backdropNaturalWidth?: number;
  backdropNaturalHeight?: number;
};

type Props = {
  walls: readonly FacilityWallPlan[];
  activeWallId: string;
  onWallChange: (id: string) => void;
  onAddWall: () => void;
  onBackdropChange?: (patch: BackdropPatch) => void;
  onGenerateEmptySpace?: () => void | Promise<void>;
  generateBusy?: boolean;
};

/**
 * Compact bottom surface tabs — editor tooling, not gallery cards.
 */
export function AdvertisingSurfaceNav({
  walls,
  activeWallId,
  onWallChange,
  onAddWall,
  onBackdropChange,
  onGenerateEmptySpace,
  generateBusy,
}: Props) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const active = walls.find((w) => w.id === activeWallId) ?? walls[0];

  return (
    <div className="flex min-w-0 items-center gap-0.5">
      <div
        className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:thin]"
        role="tablist"
        aria-label="Arena surfaces"
      >
        {walls.map((wall) => {
          const selected = wall.id === activeWallId;
          return (
            <button
              key={wall.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onWallChange(wall.id)}
              className={cn(
                "flex shrink-0 flex-col items-center gap-0.5 rounded px-1 py-0.5 transition-colors",
                selected
                  ? "bg-sky-50/90 ring-1 ring-sky-300/80"
                  : "hover:bg-white/80",
              )}
              title={wall.name}
            >
              <SurfaceThumb wall={wall} selected={selected} />
              <span
                className={cn(
                  "max-w-[3.25rem] truncate text-[9px] font-semibold leading-none",
                  selected ? "text-sky-900" : "text-slate-600",
                )}
              >
                {wall.name}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAddWall}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-dashed border-slate-300/90 text-slate-500 hover:border-sky-400 hover:bg-sky-50/70 hover:text-sky-700"
        aria-label="Add surface"
        title="Add surface"
      >
        <Plus className="h-3 w-3" aria-hidden />
      </button>

      {active && onBackdropChange ? (
        <div className="relative shrink-0">
          <button
            type="button"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded border border-slate-200/90 text-slate-600 hover:bg-white",
              photoOpen && "border-sky-300 bg-sky-50 text-sky-700",
            )}
            onClick={() => setPhotoOpen((v) => !v)}
            aria-expanded={photoOpen}
            aria-label="Surface photo"
            title="Upload backdrop photo"
          >
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
          </button>
          {photoOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Close"
                onClick={() => setPhotoOpen(false)}
              />
              <div className="absolute bottom-full left-0 z-50 mb-1 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-slate-200/90 bg-white p-2 shadow-lg">
                <WallBackdropStripControl
                  wall={active}
                  onBackdropChange={(patch) => {
                    onBackdropChange(patch);
                    setPhotoOpen(false);
                  }}
                  onGenerateEmptySpace={onGenerateEmptySpace}
                  generateBusy={generateBusy}
                />
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SurfaceThumb({ wall, selected }: { wall: FacilityWallPlan; selected: boolean }) {
  const hasPhoto = Boolean(wall.backdropUrl);
  return (
    <span
      className={cn(
        "block h-5 w-9 overflow-hidden rounded-sm border bg-slate-200",
        selected ? "border-sky-400/90" : "border-slate-200/90",
      )}
    >
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={wall.backdropUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="block h-full w-full bg-gradient-to-b from-slate-300 to-slate-400" />
      )}
    </span>
  );
}
