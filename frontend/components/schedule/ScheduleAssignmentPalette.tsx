"use client";

import { flushSync } from "react-dom";
import { setPaletteDragData } from "@/lib/schedule/drag";
import { OPERATIONAL_BADGE_REGISTRY, STANDARD_SHIFT_CATALOG } from "@/lib/schedule/operational-scheduling-model";
import { shiftCodeBadgeToneClasses } from "@/lib/schedule/scheduleWorkerPanelSort";
import { operationalBadgeClasses } from "@/lib/schedule/schedule-semantic-styles";
import { cn } from "@/lib/cn";

const EXTRA_BADGE_CODES = ["EVENT", "TRAINING", "SHADOW", "OT", "LEAD", "RELIEF", "COVERAGE", "PROJECT"] as const;

type Props = {
  disabled?: boolean;
  onDragSessionStart: (payload: { paletteKind: "shift" | "badge"; code: string }) => void;
  onDragSessionEnd: () => void;
};

/**
 * Draggable shift codes + operational badges for hybrid scheduling (palette → worker/day row).
 */
export function ScheduleAssignmentPalette({ disabled, onDragSessionStart, onDragSessionEnd }: Props) {
  const badgeCodes = [...new Set([...EXTRA_BADGE_CODES, ...Object.keys(OPERATIONAL_BADGE_REGISTRY)])].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  function startDrag(e: React.DragEvent, paletteKind: "shift" | "badge", code: string) {
    if (disabled) {
      e.preventDefault();
      return;
    }
    setPaletteDragData(e.dataTransfer, { paletteKind, code });
    flushSync(() => onDragSessionStart({ paletteKind, code }));
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-pulseShell-border/90 bg-pulseShell-surface/95 p-2 shadow-sm dark:border-slate-700/80 dark:bg-slate-950/80",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">Assignment palette</p>
      <p className="mt-0.5 text-[11px] leading-snug text-ds-muted">
        Drag onto a worker row in the calendar. Shifts set the base window; badges add overlays without replacing FT/RPT
        recurring.
      </p>

      <div className="mt-3 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Shifts</p>
        <div className="flex flex-wrap gap-1">
          {STANDARD_SHIFT_CATALOG.map((def) => (
            <button
              key={def.code}
              type="button"
              draggable={!disabled}
              title={`${def.label} · ${def.start}–${def.end}`}
              onDragStart={(e) => startDrag(e, "shift", def.code)}
              onDragEnd={onDragSessionEnd}
              className={cn(
                "cursor-grab select-none rounded border px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums tracking-tight active:cursor-grabbing",
                shiftCodeBadgeToneClasses(def.code),
              )}
            >
              {def.code}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-1 border-t border-pulseShell-border/70 pt-3 dark:border-slate-800">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">Badges</p>
        <div className="flex flex-wrap gap-1">
          {badgeCodes.map((code) => {
            const def = OPERATIONAL_BADGE_REGISTRY[code];
            const group = def?.group ?? "special";
            return (
              <button
                key={code}
                type="button"
                draggable={!disabled}
                title={def ? `${def.label}. ${def.detail ?? ""}` : code}
                onDragStart={(e) => startDrag(e, "badge", code)}
                onDragEnd={onDragSessionEnd}
                className={cn(
                  "cursor-grab select-none rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide active:cursor-grabbing",
                  operationalBadgeClasses(group),
                )}
              >
                {code}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
