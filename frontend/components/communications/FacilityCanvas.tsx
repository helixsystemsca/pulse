"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { AdSlot } from "@/modules/communications/types";
import { ExpiringSoonBadge, isExpiringSoon, StatusBadge } from "@/components/communications/StatusBadge";

type FacilityCanvasProps = {
  wallName: string;
  /** width / height */
  aspectRatio: number;
  slots: AdSlot[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  zoom: number;
  onZoomChange: (z: number) => void;
  onSlotMove: (id: string, patch: Pick<AdSlot, "x" | "y">) => void;
  className?: string;
};

type DragState = { id: string; startX: number; startY: number; origX: number; origY: number };

export function FacilityCanvas({
  wallName,
  aspectRatio,
  slots,
  selectedId,
  onSelect,
  zoom,
  onZoomChange,
  onSlotMove,
  className,
}: FacilityCanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const dx = ((e.clientX - drag.startX) / rect.width) * 100;
      const dy = ((e.clientY - drag.startY) / rect.height) * 100;
      const nx = Math.min(95, Math.max(0, drag.origX + dx));
      const ny = Math.min(90, Math.max(0, drag.origY + dy));
      onSlotMove(drag.id, { x: nx, y: ny });
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, onSlotMove]);

  const onPointerDownSlot = useCallback(
    (e: React.PointerEvent, slot: AdSlot) => {
      e.stopPropagation();
      onSelect(slot.id);
      setDrag({
        id: slot.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: slot.x,
        origY: slot.y,
      });
    },
    [onSelect],
  );

  const gridPx = Math.round(20 * (zoom / 100));

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">Wall canvas</p>
          <p className="text-sm font-semibold text-ds-foreground">{wallName}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-ds-muted">
            Grid / zoom
            <input
              type="range"
              min={70}
              max={130}
              value={zoom}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="w-28 accent-[var(--ds-accent)]"
            />
            <span className="w-10 font-mono text-ds-foreground">{zoom}%</span>
          </label>
        </div>
      </div>

      <div
        ref={rootRef}
        className="relative min-h-[220px] flex-1 cursor-default overflow-hidden rounded-2xl border border-ds-border bg-ds-secondary/20 shadow-inner"
        style={{
          aspectRatio: `${aspectRatio} / 1`,
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px),linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)",
          backgroundSize: `${gridPx}px ${gridPx}px`,
        }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onSelect(null);
        }}
      >
        {slots.map((slot) => {
          const selected = slot.id === selectedId;
          return (
            <button
              key={slot.id}
              type="button"
              onPointerDown={(e) => onPointerDownSlot(e, slot)}
              className={cn(
                "absolute flex cursor-grab flex-col rounded-lg border text-left shadow-sm active:cursor-grabbing",
                selected
                  ? "z-10 border-[var(--ds-accent)] ring-2 ring-[var(--ds-accent)]/30"
                  : "border-ds-border/80 bg-ds-primary/90",
                slot.status === "available" && "bg-emerald-500/5",
                slot.status === "reserved" && "bg-amber-500/5",
                slot.status === "occupied" && "bg-sky-500/5",
                slot.status === "expired" && "bg-ds-muted/15",
              )}
              style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                width: `${slot.width}%`,
                height: `${slot.height}%`,
              }}
            >
              <span className="pointer-events-none flex min-h-0 flex-1 flex-col p-2">
                <span className="truncate text-[11px] font-bold text-ds-foreground">{slot.name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1">
                  <StatusBadge variant="ad" status={slot.status} />
                  {slot.status === "occupied" && isExpiringSoon(slot.expiryDate) ? <ExpiringSoonBadge /> : null}
                </span>
                {slot.sponsorName ? (
                  <span className="mt-auto truncate text-[10px] text-ds-muted">{slot.sponsorName}</span>
                ) : null}
              </span>
              {selected ? (
                <>
                  <span className="pointer-events-none absolute -left-1 -top-1 h-2 w-2 rounded-sm border border-[var(--ds-accent)] bg-ds-primary" />
                  <span className="pointer-events-none absolute -right-1 -top-1 h-2 w-2 rounded-sm border border-[var(--ds-accent)] bg-ds-primary" />
                  <span className="pointer-events-none absolute -bottom-1 -left-1 h-2 w-2 rounded-sm border border-[var(--ds-accent)] bg-ds-primary" />
                  <span className="pointer-events-none absolute -bottom-1 -right-1 h-2 w-2 rounded-sm border border-[var(--ds-accent)] bg-ds-primary" />
                </>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-ds-muted">
        Drag slots to reposition (local preview). Snap grids and print/PDF export will use the same slot geometry
        later.
      </p>
    </div>
  );
}
