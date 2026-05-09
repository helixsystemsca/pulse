import type {
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

function isMandatoryProgram(p: TrainingProgram): boolean {
  return p.tier === "mandatory" && p.active;
}

function isHighRisk(p: TrainingProgram): boolean {
  return p.tier === "high_risk" && p.active;
}

/** Fully compliant: all active mandatory programs assigned & completed & not expired/revision pending/expiring treated as warn not fail — spec says "fully compliant" = strict: completed + not expired + no revision pending */
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
      if (eff !== "completed" && eff !== "expiring_soon") empOk = false;
      if (eff === "expired") empOk = false;
      if (eff === "revision_pending") empOk = false;
      if (eff === "pending" || eff === "not_assigned") empOk = false;
    }
    if (empOk) fullyCompliant++;

    for (const p of programs.filter((x) => x.active)) {
      const a = assignmentFor(e.id, p.id, resolved);
      const eff = effFor(p, a);
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

export function uniqueDepartments(employees: TrainingEmployee[]): string[] {
  const s = new Set(employees.map((e) => e.department).filter(Boolean));
  return [...s].sort((a, b) => a.localeCompare(b));
}
