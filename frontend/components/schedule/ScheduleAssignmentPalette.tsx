"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import { flushSync } from "react-dom";
import { setPaletteDragData } from "@/lib/schedule/drag";
import type { StandardShiftDefinition } from "@/lib/schedule/operational-scheduling-model";
import {
  buildPaletteBadgeRegistry,
  listPaletteBadgeCodes,
  type PaletteBadgeConfig,
  type ScheduleShiftDefinitionRow,
} from "@/lib/schedule/palette-config";
import { shiftCodeBadgeToneClasses } from "@/lib/schedule/scheduleWorkerPanelSort";
import { operationalBadgeClasses } from "@/lib/schedule/schedule-semantic-styles";
import { SchedulePaletteManageModal } from "@/components/schedule/SchedulePaletteManageModal";
import { cn } from "@/lib/cn";

type Props = {
  disabled?: boolean;
  companyId: string;
  badgeConfig: PaletteBadgeConfig;
  onBadgeConfigChange: (next: PaletteBadgeConfig) => void;
  shiftCatalog: StandardShiftDefinition[];
  shiftDefinitions: ScheduleShiftDefinitionRow[];
  onShiftDefinitionsChange: (rows: ScheduleShiftDefinitionRow[]) => void;
  onDragSessionStart: (payload: { paletteKind: "shift" | "badge"; code: string }) => void;
  onDragSessionEnd: () => void;
};

/**
 * Draggable shift codes + operational badges for hybrid scheduling (palette → worker/day row).
 */
export function ScheduleAssignmentPalette({
  disabled,
  companyId,
  badgeConfig,
  onBadgeConfigChange,
  shiftCatalog,
  shiftDefinitions,
  onShiftDefinitionsChange,
  onDragSessionStart,
  onDragSessionEnd,
}: Props) {
  const [manageOpen, setManageOpen] = useState(false);
  const badgeRegistry = buildPaletteBadgeRegistry(badgeConfig);
  const badgeCodes = listPaletteBadgeCodes(badgeRegistry);

  function startDrag(e: React.DragEvent, paletteKind: "shift" | "badge", code: string) {
    if (disabled) {
      e.preventDefault();
      return;
    }
    setPaletteDragData(e.dataTransfer, { paletteKind, code });
    flushSync(() => onDragSessionStart({ paletteKind, code }));
  }

  return (
    <>
      <div
        className={cn(
          "rounded-xl border border-pulseShell-border/90 bg-pulseShell-surface/95 p-2 shadow-sm dark:border-slate-700/80 dark:bg-slate-950/80",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">Assignment palette</p>
            <p className="mt-0.5 text-[11px] leading-snug text-ds-muted">
              Drag onto a worker row in the calendar. Shifts set the base window; badges add overlays without replacing
              FT/RPT recurring.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-md border border-pulseShell-border/80 bg-pulseShell-elevated/80 p-1.5 text-ds-muted hover:bg-ds-secondary/80 hover:text-ds-foreground"
            title="Create, edit, or hide palette badges and shifts"
            aria-label="Manage assignment palette"
            onClick={() => setManageOpen(true)}
            disabled={disabled}
          >
            <Settings2 className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">Badges</p>
            <div className="flex flex-wrap gap-1">
              {badgeCodes.length === 0 ? (
                <span className="text-[11px] text-ds-muted">No badges — open manage to add one.</span>
              ) : (
                badgeCodes.map((code) => {
                  const def = badgeRegistry[code];
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
                })
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-1 border-t border-pulseShell-border/70 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 dark:border-slate-800">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Shifts</p>
            <div className="flex flex-wrap gap-1">
              {shiftCatalog.map((def) => (
                <button
                  key={def.code}
                  type="button"
                  draggable={!disabled}
                  title={`${def.label} · ${def.start}–${def.end}`}
                  onDragStart={(e) => startDrag(e, "shift", def.code)}
                  onDragEnd={onDragSessionEnd}
                  className={cn(
                    "cursor-grab select-none rounded px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums tracking-tight active:cursor-grabbing",
                    shiftCodeBadgeToneClasses(def.code),
                  )}
                >
                  {def.code}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SchedulePaletteManageModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        companyId={companyId}
        badgeConfig={badgeConfig}
        onBadgeConfigChange={onBadgeConfigChange}
      />
    </>
  );
}
