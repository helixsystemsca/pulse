"use client";

import type { CSSProperties } from "react";

export type TaskBarProps = {
  taskId: string;
  title: string;
  durationDays: number;
  /** Solid bar width (pixels). */
  barWidthPx: number;
  /** Dashed float extension width (pixels). */
  floatWidthPx: number;
  isCritical: boolean;
  /** Slack ≤ 2 working days and > 0 — yellow dashed styling. */
  lowFloat: boolean;
  /** Non-critical bar fill (resource hue). */
  resourceTintClass: string;
  selected?: boolean;
  whatIfMode?: boolean;
  onSelect?: () => void;
  onResizePointerDown?: (e: React.PointerEvent) => void;
};

/**
 * Gantt task bar: solid work segment + optional dashed float buffer.
 * Resize handle only interactive when parent enables what-if + passes pointer handler.
 */
export function TaskBar({
  taskId,
  title,
  durationDays,
  barWidthPx,
  floatWidthPx,
  isCritical,
  lowFloat,
  resourceTintClass,
  selected,
  whatIfMode,
  onSelect,
  onResizePointerDown,
}: TaskBarProps) {
  const criticalFill = { background: "var(--pm-color-critical)" } satisfies CSSProperties;
  const floatStyle = lowFloat
    ? { borderColor: "var(--pm-low-float)" }
    : { borderColor: "var(--pm-color-primary)" };

  return (
    <div
      className={`flex min-h-[36px] items-center gap-1 ${selected ? "ring-2 ring-[var(--ds-focus-ring)]" : ""}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect?.();
      }}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className="relative flex h-7 min-w-0 flex-1 items-stretch">
        <div
          className={`relative flex h-full shrink-0 items-center overflow-hidden rounded-md text-[11px] font-bold text-white shadow-sm ${
            isCritical ? "" : resourceTintClass
          }`}
          style={{
            width: Math.max(barWidthPx, 8),
            ...(isCritical ? criticalFill : {}),
          }}
          title={title}
        >
          <span className="truncate px-1.5">
            {taskId} · {durationDays}d
          </span>
          {whatIfMode && onResizePointerDown ? (
            <button
              type="button"
              aria-label={`Resize duration for ${taskId}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                onResizePointerDown(e);
              }}
              className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-sky-300/25 hover:bg-sky-400/45"
            />
          ) : null}
        </div>
        {floatWidthPx > 1 ? (
          <div
            className="h-full border-y-2 border-dashed border-l-0 bg-transparent opacity-90"
            style={{
              width: floatWidthPx,
              ...floatStyle,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
