"use client";

import { formatMeasurement } from "@/modules/communications/advertising-mapper/lib/measurements";
import type { FacilityWallPlan, MeasurementUnit } from "@/modules/communications/advertising-mapper/types";
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
  unit: MeasurementUnit;
  onWallChange: (id: string) => void;
  onBackdropChange?: (patch: BackdropPatch) => void;
};

export function AdvertisingWallStrip({ walls, activeWallId, unit, onWallChange, onBackdropChange }: Props) {
  const active = walls.find((w) => w.id === activeWallId) ?? walls[0];
  if (!active) return null;

  const totalInventory = active.blocks.length;
  const available = active.blocks.filter((b) => b.status === "available").length;
  const occupied = active.blocks.filter((b) => b.status === "occupied" || b.status === "reserved").length;
  const wallLengthFt = formatMeasurement(active.width_inches, unit);

  return (
    <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-stretch sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        {walls.map((wall) => {
          const selected = wall.id === activeWallId;
          return (
            <button
              key={wall.id}
              type="button"
              onClick={() => onWallChange(wall.id)}
              className={cn(
                "flex shrink-0 flex-col items-center gap-1 rounded-lg border px-2 pb-1.5 pt-1 transition-colors",
                selected
                  ? "border-sky-400 bg-sky-50 ring-1 ring-sky-200"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300",
              )}
            >
              <WallThumb wall={wall} />
              <span className={cn("text-[10px] font-semibold", selected ? "text-sky-800" : "text-slate-600")}>
                {shortWallName(wall.name)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="min-w-0 shrink-0 border-t border-slate-200 pt-2 sm:flex sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        <div className="text-left sm:text-right">
          <p className="text-xs font-semibold text-slate-800">{active.name}</p>
          <p className="text-[10px] text-slate-500">
            Wall length {wallLengthFt} · Inventory {totalInventory} · Available {available} · Occupied {occupied}
          </p>
        </div>
        {onBackdropChange ? (
          <WallBackdropStripControl
            wall={active}
            onBackdropChange={onBackdropChange}
            className="mt-2 items-start sm:mt-0 sm:items-end"
          />
        ) : null}
      </div>
    </div>
  );
}

function shortWallName(name: string): string {
  return name.trim();
}

function WallThumb({ wall }: { wall: FacilityWallPlan }) {
  const aspect = wall.width_inches / Math.max(wall.height_inches, 1);
  const w = aspect >= 2.5 ? 72 : 56;
  const h = Math.round(w / aspect);
  const hasPhoto = Boolean(wall.backdropUrl);

  return (
    <div
      className="relative overflow-hidden rounded border border-slate-200/80 bg-slate-200"
      style={{ width: w, height: Math.min(h, 36) }}
    >
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={wall.backdropUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-end justify-center gap-0.5 bg-gradient-to-b from-slate-300 to-slate-400 p-1">
          {wall.blocks.slice(0, 4).map((b) => (
            <div
              key={b.id}
              className="rounded-sm bg-white/70"
              style={{
                width: Math.max(4, (b.width_inches / wall.width_inches) * (w - 8)),
                height: Math.max(3, (b.height_inches / wall.height_inches) * (h - 6)),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
