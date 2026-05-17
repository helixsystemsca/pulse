"use client";

import { blockStyleForStatus } from "@/modules/communications/advertising-mapper/lib/block-styles";
import type { FacilityWallPlan, InventoryBlock } from "@/modules/communications/advertising-mapper/types";

type Props = {
  wall: FacilityWallPlan;
  blocks: InventoryBlock[];
  viewportRect: { x: number; y: number; width: number; height: number } | null;
  onNavigate?: (wallX: number, wallY: number) => void;
};

const MAP_W = 140;
const MAP_H = 48;

export function PlannerMinimap({ wall, blocks, viewportRect, onNavigate }: Props) {
  const scaleX = MAP_W / wall.width_inches;
  const scaleY = MAP_H / wall.height_inches;

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-30 rounded-lg border border-ds-border bg-ds-primary/95 p-2 shadow-lg backdrop-blur-sm">
      <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-ds-muted">Overview</p>
      <button
        type="button"
        className="relative block overflow-hidden rounded border border-ds-border/80 bg-[#1a1f2e]"
        style={{ width: MAP_W, height: MAP_H }}
        onClick={(e) => {
          if (!onNavigate) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const rx = (e.clientX - rect.left) / MAP_W;
          const ry = (e.clientY - rect.top) / MAP_H;
          onNavigate(rx * wall.width_inches, ry * wall.height_inches);
        }}
        aria-label="Minimap — click to pan"
      >
        {blocks.map((b) => {
          const style = blockStyleForStatus(b.status);
          return (
            <span
              key={b.id}
              className="absolute rounded-[1px] border"
              style={{
                left: b.x * scaleX,
                top: b.y * scaleY,
                width: Math.max(2, b.width_inches * scaleX),
                height: Math.max(2, b.height_inches * scaleY),
                backgroundColor: style.fill,
                borderColor: style.stroke,
              }}
            />
          );
        })}
        {viewportRect ? (
          <span
            className="pointer-events-none absolute border-2 border-[var(--ds-accent)] bg-[var(--ds-accent)]/10"
            style={{
              left: viewportRect.x * scaleX,
              top: viewportRect.y * scaleY,
              width: Math.max(4, viewportRect.width * scaleX),
              height: Math.max(4, viewportRect.height * scaleY),
            }}
          />
        ) : null}
      </button>
    </div>
  );
}
