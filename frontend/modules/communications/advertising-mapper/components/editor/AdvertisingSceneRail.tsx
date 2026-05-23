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

/** Left scene rail — compact vertical surface tabs (~25% denser than legacy strip). */
export function AdvertisingSceneRail({
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-200/80 px-2 py-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Surfaces</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1.5 py-1.5 [scrollbar-width:thin]">
        <div className="flex flex-col gap-1">
          {walls.map((wall) => {
            const selected = wall.id === activeWallId;
            return (
              <button
                key={wall.id}
                type="button"
                onClick={() => onWallChange(wall.id)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left transition-colors",
                  selected
                    ? "border-sky-400/90 bg-sky-50/90 ring-1 ring-sky-200/70"
                    : "border-transparent hover:border-slate-200 hover:bg-white/70",
                )}
              >
                <SceneThumb wall={wall} />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[11px] font-semibold leading-tight",
                    selected ? "text-sky-900" : "text-slate-700",
                  )}
                >
                  {wall.name}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onAddWall}
            className="flex h-8 w-full items-center justify-center gap-1 rounded-md border border-dashed border-slate-300/90 text-[10px] font-semibold text-slate-500 hover:border-sky-400 hover:bg-sky-50/60 hover:text-sky-700"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Add
          </button>
        </div>
      </div>

      {active && onBackdropChange ? (
        <div className="relative shrink-0 border-t border-slate-200/80 p-1.5">
          <button
            type="button"
            className={cn(
              "flex h-7 w-full items-center justify-center gap-1 rounded-md text-[10px] font-semibold text-slate-600 hover:bg-white",
              photoOpen && "bg-white text-sky-700 ring-1 ring-sky-200/80",
            )}
            onClick={() => setPhotoOpen((v) => !v)}
            aria-expanded={photoOpen}
          >
            <ImagePlus className="h-3 w-3" aria-hidden />
            Photo
          </button>
          {photoOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Close"
                onClick={() => setPhotoOpen(false)}
              />
              <div className="absolute bottom-full left-1.5 right-1.5 z-50 mb-1 rounded-lg border border-slate-200/90 bg-white p-2 shadow-lg">
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

function SceneThumb({ wall }: { wall: FacilityWallPlan }) {
  const hasPhoto = Boolean(wall.backdropUrl);
  return (
    <span className="relative block h-[26px] w-[38px] shrink-0 overflow-hidden rounded border border-slate-200/80 bg-slate-200">
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={wall.backdropUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="block h-full w-full bg-gradient-to-b from-slate-300 to-slate-400" />
      )}
    </span>
  );
}
