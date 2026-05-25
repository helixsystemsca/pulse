import type { Shift, Worker } from "@/lib/schedule/types";

/** Roles excluded from Daily assignments and the ops Routine assignments widget. */
const ROUTINE_ASSIGNMENT_EXCLUDED_ROLES = new Set(["manager", "supervisor"]);

function normalizeRole(role: string | null | undefined): string {
  return (role ?? "").trim().toLowerCase();
}

export function isRoutineAssignmentWorkforceRole(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  if (!r) return true;
  return !ROUTINE_ASSIGNMENT_EXCLUDED_ROLES.has(r);
}

export function isRoutineAssignmentWorkforceWorker(worker: Pick<Worker, "role">): boolean {
  return isRoutineAssignmentWorkforceRole(worker.role);
}

export function isRoutineAssignmentWorkforceShift(
  shift: Pick<Shift, "role" | "workerId">,
  worker: Pick<Worker, "role"> | null | undefined,
): boolean {
  if (!shift.workerId) return false;
  if (!isRoutineAssignmentWorkforceRole(shift.role)) return false;
  if (worker && !isRoutineAssignmentWorkforceWorker(worker)) return false;
  return true;
}
