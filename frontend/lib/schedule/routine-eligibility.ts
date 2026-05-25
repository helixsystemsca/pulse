import { isArenaRoutineName, parseArenaRoutineName } from "@/lib/schedule/arena-routine-catalog";
import { certificationLabel } from "@/lib/schedule/certifications";
import { workerEffectiveCertificationCodes } from "@/lib/standards/qualification-overrides";
import type { RoutineDetail, RoutineItemRow, RoutineShiftBand } from "@/lib/routinesService";
import type { Shift, ShiftTypeKey, Worker } from "@/lib/schedule/types";
import { assignmentFor } from "@/lib/training/selectors";
import { cellAssignmentStatus } from "@/lib/training/mockData";
import type {
  TrainingAcknowledgement,
  TrainingAssignment,
  TrainingAssignmentStatus,
  TrainingProgram,
} from "@/lib/training/types";
import type { WorkerDayHighlightTone } from "@/lib/schedule/worker-drag-highlights";

export type RoutineEligibilityTone = WorkerDayHighlightTone;

export type RoutineEligibilityResult = {
  tone: RoutineEligibilityTone;
  eligible: boolean;
  tooltip?: string;
};

export type RoutineTrainingContext = {
  programs: TrainingProgram[];
  assignments: TrainingAssignment[];
  acknowledgements: TrainingAcknowledgement[];
};

const TRAINING_OK: ReadonlySet<TrainingAssignmentStatus> = new Set(["completed", "expiring_soon"]);

function shiftCertBlock(worker: Worker, shift: Shift): string | null {
  const certs = shift.required_certifications?.filter(Boolean) ?? [];
  if (!certs.length || shift.eventType !== "work") return null;
  const wc = workerEffectiveCertificationCodes(worker);
  if (shift.accepts_any_certification === true) {
    if (certs.some((c) => wc.includes(c))) return null;
    return certs.length === 1
      ? `Missing ${certificationLabel(certs[0]!)} for this shift`
      : `Requires one of: ${certs.map(certificationLabel).join(", ")}`;
  }
  const missing = certs.filter((c) => !wc.includes(c));
  if (!missing.length) return null;
  if (missing.length === 1) return `Missing ${certificationLabel(missing[0]!)} for this shift`;
  return `Missing certifications: ${missing.map(certificationLabel).join(", ")}`;
}

export function routineItemsForShiftBand(items: RoutineItemRow[], shiftType: ShiftTypeKey): RoutineItemRow[] {
  const band = shiftType as RoutineShiftBand;
  return items.filter((it) => !it.shift_band || it.shift_band === band);
}

function trainingBlock(
  workerId: string,
  procedureId: string,
  ctx: RoutineTrainingContext,
): string | null {
  const program = ctx.programs.find((p) => p.id === procedureId);
  if (!program || !program.active) return null;
  const assignment = assignmentFor(workerId, procedureId, ctx.assignments);
  const status = cellAssignmentStatus(program, assignment, ctx.acknowledgements, {
    trustAssignmentStatus: true,
  });
  if (TRAINING_OK.has(status)) return null;
  if (status === "not_assigned" || status === "not_applicable") {
    return `Not assigned to training: ${program.title}`;
  }
  return `Training incomplete: ${program.title} (${status.replace(/_/g, " ")})`;
}

/**
 * Whether a worker on a specific shift may receive this routine (certs + linked procedures).
 */
export function evaluateRoutineAssignmentEligibility(
  worker: Worker,
  shift: Shift,
  routine: RoutineDetail,
  training: RoutineTrainingContext,
): RoutineEligibilityResult {
  if (!worker.active) {
    return { tone: "neutral", eligible: false, tooltip: "Worker is inactive" };
  }
  if (shift.workerId !== worker.id) {
    return { tone: "neutral", eligible: false, tooltip: "Shift is not assigned to this worker" };
  }

  const certReason = shiftCertBlock(worker, shift);
  if (certReason) {
    return { tone: "invalid", eligible: false, tooltip: certReason };
  }

  if (isArenaRoutineName(routine.name)) {
    const meta = parseArenaRoutineName(routine.name);
    if (meta.kind === "main" && meta.shiftBand && meta.shiftBand !== shift.shiftType) {
      return {
        tone: "invalid",
        eligible: false,
        tooltip: `This is a ${meta.shiftBand} shift routine — drop it on a ${meta.shiftBand} worker row`,
      };
    }
  }

  const items = routineItemsForShiftBand(routine.items, shift.shiftType);
  if (items.length === 0) {
    return {
      tone: "invalid",
      eligible: false,
      tooltip: `No checklist lines for ${shift.shiftType} shift on this routine`,
    };
  }
  const required = items.filter((it) => it.required);
  for (const it of required) {
    const pid = (it.procedure_id ?? "").trim();
    if (!pid) continue;
    const trainReason = trainingBlock(worker.id, pid, training);
    if (trainReason) {
      return { tone: "invalid", eligible: false, tooltip: trainReason };
    }
  }

  const optionalWithProc = items.filter((it) => !it.required && (it.procedure_id ?? "").trim());
  for (const it of optionalWithProc) {
    const trainReason = trainingBlock(worker.id, (it.procedure_id ?? "").trim(), training);
    if (trainReason) {
      return { tone: "warning", eligible: true, tooltip: `${trainReason} (optional line)` };
    }
  }

  return { tone: "good", eligible: true, tooltip: "Eligible — certifications and training satisfied" };
}

export function buildRoutineEligibilityByRowKey(
  rows: Array<{ rowKey: string; worker: Worker; shift: Shift }>,
  routine: RoutineDetail | null,
  training: RoutineTrainingContext,
): Record<string, RoutineEligibilityResult> {
  const map: Record<string, RoutineEligibilityResult> = {};
  if (!routine) {
    for (const { rowKey } of rows) {
      map[rowKey] = { tone: "neutral", eligible: false };
    }
    return map;
  }
  for (const { rowKey, worker, shift } of rows) {
    map[rowKey] = evaluateRoutineAssignmentEligibility(worker, shift, routine, training);
  }
  return map;
}
