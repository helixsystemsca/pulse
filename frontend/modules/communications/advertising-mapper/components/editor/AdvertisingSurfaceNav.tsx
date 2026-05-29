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
  /** `rail` = vertical left sidebar; `strip` = compact horizontal footer tabs. */
  variant?: "rail" | "strip";
};

/**
 * Surface switcher — arena views (Left, Center, Right, Scoreboard, …).
 */
export function AdvertisingSurfaceNav({
  walls,
  activeWallId,
  onWallChange,
  onAddWall,
  onBackdropChange,
  onGenerateEmptySpace,
  generateBusy,
  variant = "strip",
}: Props) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const active = walls.find((w) => w.id === activeWallId) ?? walls[0];

  if (variant === "rail") {
    return (
      <nav className="flex h-full min-h-0 flex-col" aria-label="Arena surfaces">
        <div className="shrink-0 border-b border-slate-200/80 px-2 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Surfaces</p>
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1.5 py-2 [scrollbar-width:thin]"
          role="tablist"
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
                  "flex w-full flex-col items-stretch gap-1 rounded-lg border px-1.5 py-1.5 text-left transition-colors",
                  selected
                    ? "border-sky-300/90 bg-sky-50/95 ring-1 ring-sky-200/80"
                    : "border-transparent bg-white/40 hover:border-slate-200/90 hover:bg-white/90",
                )}
                title={wall.name}
              >
                <SurfaceThumb wall={wall} selected={selected} variant="rail" />
                <span
                  className={cn(
                    "truncate text-center text-[10px] font-semibold leading-tight",
                    selected ? "text-sky-900" : "text-slate-600",
                  )}
                >
                  {wall.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 flex-col gap-1 border-t border-slate-200/80 p-1.5">
          <button
            type="button"
            onClick={onAddWall}
            className="flex h-8 w-full items-center justify-center gap-1 rounded-md border border-dashed border-slate-300/90 text-[10px] font-semibold text-slate-600 hover:border-sky-400 hover:bg-sky-50/70 hover:text-sky-800"
            aria-label="Add surface"
            title="Add surface"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Add
          </button>

          {active && onBackdropChange ? (
            <div className="relative">
              <button
                type="button"
                className={cn(
                  "flex h-8 w-full items-center justify-center gap-1 rounded-md border border-slate-200/90 text-[10px] font-semibold text-slate-600 hover:bg-white",
                  photoOpen && "border-sky-300 bg-sky-50 text-sky-800",
                )}
                onClick={() => setPhotoOpen((v) => !v)}
                aria-expanded={photoOpen}
                aria-label="Surface photo"
                title="Upload backdrop photo"
              >
                <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
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
                  <div className="absolute bottom-full left-0 z-50 mb-1 w-[min(18rem,calc(100vw-6rem))] rounded-lg border border-slate-200/90 bg-white p-2 shadow-lg">
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
      </nav>
    );
  }

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
                selected ? "bg-sky-50/90 ring-1 ring-sky-300/80" : "hover:bg-white/80",
              )}
              title={wall.name}
            >
              <SurfaceThumb wall={wall} selected={selected} variant="strip" />
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

function SurfaceThumb({
  wall,
  selected,
  variant,
}: {
  wall: FacilityWallPlan;
  selected: boolean;
  variant: "rail" | "strip";
}) {
  const hasPhoto = Boolean(wall.backdropUrl);
  return (
    <span
      className={cn(
        "block overflow-hidden rounded-sm border bg-slate-200",
        variant === "rail" ? "aspect-[16/10] w-full" : "h-5 w-9",
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
