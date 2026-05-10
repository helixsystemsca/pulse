"use client";

import { inferStandardShiftCode, standardShiftByCode } from "@/lib/schedule/shift-definition-catalog";
import { ASSIGNMENT_CODE_CHIP } from "@/lib/schedule/schedule-semantic-styles";
import { formatTimeString } from "@/lib/schedule/time-format";
import type { ScheduleSettings, Shift, Zone } from "@/lib/schedule/types";
import { deriveOperationalBadges } from "./assignment-badges";
import { OperationalBadgeStack } from "./OperationalBadgeStack";

function buildTooltip(params: {
  code: string;
  shift: Shift;
  zoneLabel: string;
  workerName: string;
  settings: ScheduleSettings;
}): string {
  const { code, shift, zoneLabel, workerName, settings } = params;
  const def = standardShiftByCode(code);
  const tf = settings.timeFormat ?? "12h";
  const start = formatTimeString(shift.startTime, tf);
  const end = formatTimeString(shift.endTime, tf);
  const lines = [
    def ? `${code} — ${def.label}` : code,
    `${start}–${end}`,
    `Employee: ${workerName}`,
    zoneLabel && zoneLabel !== "—" ? `Facility: ${zoneLabel}` : "",
    shift.availabilityOverrideReason ? `Override: ${shift.availabilityOverrideReason}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export function AssignmentCard({
  shift,
  workerName,
  zone,
  settings,
  compact = true,
  onOpen,
}: {
  shift: Shift;
  workerName: string;
  zone: Zone | undefined;
  settings: ScheduleSettings;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const zoneLabel = zone?.label ?? "—";
  const code =
    (shift.shiftCode && shift.shiftCode.trim()) ||
    inferStandardShiftCode(shift.startTime, shift.endTime) ||
    shift.shiftType.toUpperCase().slice(0, 1);
  const badges = deriveOperationalBadges(shift);
  const tip = buildTooltip({ code, shift, zoneLabel, workerName, settings });

  return (
    <button
      type="button"
      title={tip}
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.();
      }}
      className={`w-full rounded-lg border border-pulseShell-border bg-pulseShell-surface text-left shadow-sm transition-colors hover:bg-ds-interactive-hover/50 dark:hover:bg-ds-interactive-hover/30 ${
        compact ? "px-1.5 py-1" : "px-2 py-1.5"
      }`}
    >
      <div className="flex min-w-0 items-start gap-1">
        <span className={ASSIGNMENT_CODE_CHIP}>{code}</span>
        <div className="min-w-0 flex-1">
          <p className={`truncate font-semibold leading-tight text-ds-foreground ${compact ? "text-[10px]" : "text-xs"}`}>
            {workerName}
          </p>
          <div className="mt-0.5 flex min-w-0 items-center gap-0.5">
            <OperationalBadgeStack codes={badges} />
          </div>
        </div>
      </div>
    </button>
  );
}
