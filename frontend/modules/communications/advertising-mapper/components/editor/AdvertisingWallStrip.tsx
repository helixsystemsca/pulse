"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Pencil, Plus } from "lucide-react";
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
  onWallRename: (id: string, name: string) => void;
  onAddWall: () => void;
  onBackdropChange?: (patch: BackdropPatch) => void;
  onGenerateEmptySpace?: () => void | Promise<void>;
  generateBusy?: boolean;
  viewportControls?: ReactNode;
};

export function AdvertisingWallStrip({
  walls,
  activeWallId,
  unit,
  onWallChange,
  onWallRename,
  onAddWall,
  onBackdropChange,
  onGenerateEmptySpace,
  generateBusy,
  viewportControls,
}: Props) {
  const active = walls.find((w) => w.id === activeWallId) ?? walls[0];
  if (!active) return null;

  const totalInventory = active.blocks.length;
  const available = active.blocks.filter((b) => b.status === "available").length;
  const occupied = active.blocks.filter((b) => b.status === "occupied" || b.status === "reserved").length;
  const wallLengthFt = formatMeasurement(active.width_inches, unit);

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="relative flex min-h-[4.25rem] items-center justify-center">
        <div className="flex w-full min-w-0 items-center gap-2 overflow-x-auto pb-0.5 pr-2 [scrollbar-width:thin]">
          <button
            type="button"
            onClick={onAddWall}
            className="flex h-[3.25rem] w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-600 transition-colors hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700"
            aria-label="Add viewport"
            title="Add viewport"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span className="text-[9px] font-bold uppercase tracking-wide">Add</span>
          </button>
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
                <span className={cn("max-w-[4.5rem] truncate text-[10px] font-semibold", selected ? "text-sky-800" : "text-slate-600")}>
                  {wall.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center px-[5.5rem]">
          <ViewportNameCenter name={active.name} onRename={(next) => onWallRename(active.id, next)} />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200/90 pt-3 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-center text-[10px] text-slate-500 lg:text-left">
            Wall length {wallLengthFt} · Inventory {totalInventory} · Available {available} · Occupied {occupied}
          </p>
          {onBackdropChange ? (
            <WallBackdropStripControl
              wall={active}
              onBackdropChange={onBackdropChange}
              onGenerateEmptySpace={onGenerateEmptySpace}
              generateBusy={generateBusy}
            />
          ) : null}
        </div>

        {viewportControls ? (
          <div className="flex shrink-0 items-center justify-start border-t border-slate-200/80 pt-3 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            {viewportControls}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ViewportNameCenter({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    const next = draft.trim();
    if (next && next !== name) onRename(next);
    else setDraft(name);
    setEditing(false);
  }

  return (
    <div className="pointer-events-auto flex max-w-[min(100%,14rem)] items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1 shadow-sm backdrop-blur-sm">
      {editing ? (
        <label htmlFor={inputId} className="sr-only">
          Viewport name
        </label>
      ) : null}
      {editing ? (
        <input
          ref={inputRef}
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setDraft(name);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-center text-sm font-semibold text-slate-800 outline-none ring-0"
          maxLength={48}
        />
      ) : (
        <span className="truncate text-sm font-semibold text-slate-800">{name}</span>
      )}
      <button
        type="button"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-sky-700"
        aria-label={editing ? "Save viewport name" : "Edit viewport name"}
        title={editing ? "Save" : "Edit name"}
        onClick={() => {
          if (editing) commit();
          else setEditing(true);
        }}
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
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
