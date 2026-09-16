"use client";

import { displayStandardShiftCode, standardShiftByCode } from "@/lib/schedule/shift-definition-catalog";
import { ASSIGNMENT_CODE_CHIP } from "@/lib/schedule/schedule-semantic-styles";
import { formatTimeString } from "@/lib/schedule/time-format";
import { evaluateShiftAssignmentAlarms } from "@/lib/schedule/assignment-eligibility";
import type { ScheduleSettings, Shift, Worker, Zone } from "@/lib/schedule/types";
import { AssignmentTrainingAlarmBadge } from "../AssignmentTrainingAlarmBadge";
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
  worker,
  zone,
  settings,
  compact = true,
  shiftDefinitions,
  onOpen,
}: {
  shift: Shift;
  workerName: string;
  worker?: Worker | null;
  zone: Zone | undefined;
  settings: ScheduleSettings;
  compact?: boolean;
  shiftDefinitions?: Array<{ id: string; code: string; cert_requirements?: unknown }>;
  onOpen?: () => void;
}) {
  const zoneLabel = zone?.label ?? "—";
  const code = displayStandardShiftCode(shift);
  const badges = deriveOperationalBadges(shift);
  const tip = buildTooltip({ code, shift, zoneLabel, workerName, settings });
  const trainingAlarms = evaluateShiftAssignmentAlarms(shift, worker ?? null, shiftDefinitions);

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
            <AssignmentTrainingAlarmBadge alarms={trainingAlarms} size="compact" />
            <OperationalBadgeStack codes={badges} />
          </div>
        </div>
      </div>
    </button>
  );
}
