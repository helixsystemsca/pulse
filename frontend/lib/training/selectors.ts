import type {
  TrainingAcknowledgement,
  TrainingAssignment,
  TrainingAssignmentStatus,
  TrainingEmployee,
  TrainingProgram,
  TrainingTier,
} from "./types";
import {
  MOCK_RESOLVED_ASSIGNMENTS,
  MOCK_TRAINING_ACKNOWLEDGEMENTS,
  MOCK_TRAINING_EMPLOYEES,
  MOCK_TRAINING_PROGRAMS,
  cellAssignmentStatus,
  resolvedAssignments,
} from "./mockData";

export type TrainingMatrixFilters = {
  department: string;
  tier: TrainingTier | "all";
  status: TrainingAssignmentStatus | "all";
  search: string;
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Stable demo persona for any real worker id (profile drawer) */
export function demoPersonaEmployeeId(actualEmployeeId: string): string {
  let h = 0;
  for (let i = 0; i < actualEmployeeId.length; i++) h = (Math.imul(31, h) + actualEmployeeId.charCodeAt(i)) >>> 0;
  const idx = h % MOCK_TRAINING_EMPLOYEES.length;
  return MOCK_TRAINING_EMPLOYEES[idx]!.id;
}

export function trainingAssignmentsForPersona(actualEmployeeId: string): TrainingAssignment[] {
  const personaId = demoPersonaEmployeeId(actualEmployeeId);
  return MOCK_RESOLVED_ASSIGNMENTS.filter((a) => a.employee_id === personaId).map((a) => ({
    ...a,
    employee_id: actualEmployeeId,
    id: `demo-${actualEmployeeId}-${a.training_program_id}`,
  }));
}

export function trainingAcknowledgementsForPersona(actualEmployeeId: string): typeof MOCK_TRAINING_ACKNOWLEDGEMENTS {
  const personaId = demoPersonaEmployeeId(actualEmployeeId);
  return MOCK_TRAINING_ACKNOWLEDGEMENTS.filter((k) => k.employee_id === personaId).map((k) => ({
    ...k,
    employee_id: actualEmployeeId,
    id: `demo-${actualEmployeeId}-${k.training_program_id}-ack`,
  }));
}

export function trainingEmployeeShell(
  actualEmployeeId: string,
  displayName: string,
  department: string | null | undefined,
  supervisorName?: string | null,
): TrainingEmployee {
  return {
    id: actualEmployeeId,
    display_name: displayName,
    department: department?.trim() || "—",
    supervisor_name: supervisorName ?? null,
  };
}

export function assignmentFor(
  employeeId: string,
  programId: string,
  assignments: TrainingAssignment[],
): TrainingAssignment | undefined {
  return assignments.find((a) => a.employee_id === employeeId && a.training_program_id === programId);
}

export function filterEmployees(employees: TrainingEmployee[], search: string): TrainingEmployee[] {
  const q = norm(search);
  if (!q) return employees;
  return employees.filter(
    (e) => norm(e.display_name).includes(q) || norm(e.department).includes(q) || norm(e.id).includes(q),
  );
}

/** Department + employee search only — tier/status scope the matrix columns and cells, not which rows appear. */
export function passesMatrixFilters(employee: TrainingEmployee, filters: TrainingMatrixFilters): boolean {
  if (filters.department !== "all" && employee.department !== filters.department) return false;
  return filterEmployees([employee], filters.search).length > 0;
}

export type ComplianceSummary = {
  totalEmployees: number;
  fullyCompliant: number;
  expiredCertifications: number;
  pendingAcknowledgements: number;
  highRiskOverdue: number;
};

export type ComplianceRadialSummary = {
  /** Total routines-tier assignment slots (employees × active routines programs). */
  totalSlots: number;
  /** Slots excluded from compliance % (e.g. admin-marked not applicable). */
  skippedSlots: number;
  completed: number;
  expiringSoon: number;
  missing: number;
  /** \((completed + expiringSoon) / (totalSlots - skippedSlots)\) rounded; 100% when every counted slot is complete or expiring-soon. */
  overallCompliancePercent: number;
};

function isMandatoryProgram(p: TrainingProgram): boolean {
  return p.tier === "mandatory" && p.active;
}

function isHighRisk(p: TrainingProgram): boolean {
  return p.tier === "high_risk" && p.active;
}

/** Fully compliant: all active routines-tier programs assigned & completed & not expired/revision pending/expiring treated as warn not fail — spec says "fully compliant" = strict: completed + not expired + no revision pending */
export function computeComplianceSummary(
  employees: TrainingEmployee[],
  programs: TrainingProgram[],
  assignments: TrainingAssignment[],
  acks: typeof MOCK_TRAINING_ACKNOWLEDGEMENTS,
  opts?: { trustAssignmentStatus?: boolean },
): ComplianceSummary {
  const resolved = opts?.trustAssignmentStatus
    ? assignments
    : resolvedAssignments(programs, assignments, acks);
  const mandatory = programs.filter(isMandatoryProgram);

  let fullyCompliant = 0;
  let expiredCertifications = 0;
  let pendingAcknowledgements = 0;
  let highRiskOverdue = 0;

  const today = new Date();

  const effFor = (p: TrainingProgram, a: TrainingAssignment | undefined) =>
    cellAssignmentStatus(p, a, acks, opts);

  for (const e of employees) {
    let empOk = true;
    for (const p of mandatory) {
      const a = assignmentFor(e.id, p.id, resolved);
      const eff = effFor(p, a);
      if (eff === "not_applicable") continue;
      if (eff !== "completed" && eff !== "expiring_soon") empOk = false;
      if (eff === "expired") empOk = false;
      if (eff === "revision_pending") empOk = false;
      if (eff === "pending" || eff === "not_assigned") empOk = false;
    }
    if (empOk) fullyCompliant++;

    for (const p of programs.filter((x) => x.active)) {
      const a = assignmentFor(e.id, p.id, resolved);
      const eff = effFor(p, a);
      if (eff === "not_applicable") continue;
      if (eff === "expired") expiredCertifications++;

      if (eff === "revision_pending") pendingAcknowledgements++;
      else if (
        p.requires_acknowledgement &&
        a?.completed_date &&
        !a.acknowledgement_date
      ) {
        pendingAcknowledgements++;
      }

      if (isHighRisk(p)) {
        const duePast = a?.due_date ? new Date(a.due_date) < today : false;
        if (eff === "expired" || (eff === "pending" && duePast)) highRiskOverdue++;
      }
    }
  }

  return {
    totalEmployees: employees.length,
    fullyCompliant,
    expiredCertifications,
    pendingAcknowledgements,
    highRiskOverdue,
  };
}

/**
 * Summary for "radial compliance" UI: counts routines-tier program slots as completed / expiring soon / missing.
 * - completed: `completed`
 * - expiringSoon: `expiring_soon`
 * - missing: other counted states (`expired`, `pending`, `not_assigned`, `revision_pending`, etc.)
 * - `not_applicable` slots are excluded from those three buckets and from the compliance percent denominator (`skippedSlots`).
 *
 * Notes:
 * - This is intentionally scoped to active routines-tier programs; other tiers can be added later.
 * - When `trustAssignmentStatus` is true, server status is treated as authoritative and `acks` may be empty.
 */
export function computeComplianceRadialSummary(
  employees: TrainingEmployee[],
  programs: TrainingProgram[],
  assignments: TrainingAssignment[],
  acks: typeof MOCK_TRAINING_ACKNOWLEDGEMENTS,
  opts?: { trustAssignmentStatus?: boolean },
): ComplianceRadialSummary {
  const resolved = opts?.trustAssignmentStatus
    ? assignments
    : resolvedAssignments(programs, assignments, acks);
  const mandatory = programs.filter(isMandatoryProgram);

  let completed = 0;
  let expiringSoon = 0;
  let missing = 0;
  let skippedSlots = 0;

  const effFor = (p: TrainingProgram, a: TrainingAssignment | undefined) =>
    cellAssignmentStatus(p, a, acks, opts);

  for (const e of employees) {
    for (const p of mandatory) {
      const a = assignmentFor(e.id, p.id, resolved);
      const eff = effFor(p, a);
      if (eff === "not_applicable") {
        skippedSlots++;
        continue;
      }
      if (eff === "completed") completed++;
      else if (eff === "expiring_soon") expiringSoon++;
      else missing++;
    }
  }

  const totalSlots = employees.length * mandatory.length;
  const counted = totalSlots - skippedSlots;
  const overallCompliancePercent =
    counted <= 0 ? (totalSlots <= 0 ? 0 : 100) : Math.round(((completed + expiringSoon) / counted) * 100);

  return { totalSlots, skippedSlots, completed, expiringSoon, missing, overallCompliancePercent };
}

/**
 * Company-wide completion rate for a single training program column: share of employees whose
 * effective matrix cell is `completed` or `expiring_soon` (aligned with radial “in compliance” treatment).
 */
export function computeProgramColumnCompliancePercent(
  programId: string,
  employees: TrainingEmployee[],
  programs: TrainingProgram[],
  assignments: TrainingAssignment[],
  acknowledgements: TrainingAcknowledgement[],
  opts?: { trustAssignmentStatus?: boolean },
): number | null {
  const program = programs.find((p) => p.id === programId && p.active);
  if (!program || employees.length === 0) return null;

  const resolved = opts?.trustAssignmentStatus
    ? assignments
    : resolvedAssignments(programs, assignments, acknowledgements);

  let inCompliance = 0;
  let counted = 0;
  for (const e of employees) {
    const a = assignmentFor(e.id, programId, resolved);
    const eff = cellAssignmentStatus(program, a, acknowledgements, opts);
    if (eff === "not_applicable") continue;
    counted++;
    if (eff === "completed" || eff === "expiring_soon") inCompliance++;
  }

  if (counted === 0) return employees.length === 0 ? null : 100;
  return Math.round((inCompliance / counted) * 100);
}

export function uniqueDepartments(employees: TrainingEmployee[]): string[] {
  const s = new Set(employees.map((e) => e.department).filter(Boolean));
  return [...s].sort((a, b) => a.localeCompare(b));
}
