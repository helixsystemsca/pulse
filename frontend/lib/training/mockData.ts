import type {
  TrainingAcknowledgement,
  TrainingAssignment,
  TrainingAssignmentStatus,
  TrainingEmployee,
  TrainingProgram,
} from "./types";
import { isRevisionPendingForAssignment } from "./revision";

/** Seed programs — operational wording */
export const MOCK_TRAINING_PROGRAMS: TrainingProgram[] = [
  {
    id: "tp-orientation",
    title: "New Employee Orientation",
    description: "Facility rules, emergency response, reporting lines.",
    tier: "mandatory",
    program_type: "course",
    category: "Onboarding",
    department_category: "",
    revision_number: 3,
    revision_date: "2026-03-01",
    requires_acknowledgement: true,
    expiry_months: null,
    active: true,
  },
  {
    id: "tp-whmis",
    title: "WHMIS",
    description: "Hazard communication and SDS literacy.",
    tier: "mandatory",
    program_type: "course",
    category: "Compliance",
    department_category: "",
    revision_number: 2,
    revision_date: "2025-11-15",
    requires_acknowledgement: true,
    expiry_months: 36,
    active: true,
  },
  {
    id: "tp-pool-chem",
    title: "Pool Chemical Handling",
    description: "Storage, dosing, spill response, PPE.",
    tier: "high_risk",
    program_type: "course",
    category: "Chemicals",
    department_category: "aquatics",
    revision_number: 4,
    revision_date: "2026-01-10",
    requires_acknowledgement: true,
    expiry_months: 12,
    active: true,
  },
  {
    id: "tp-loto",
    title: "Lockout / Tagout",
    description: "Energy isolation for maintenance work.",
    tier: "high_risk",
    program_type: "course",
    category: "Equipment",
    department_category: "maintenance",
    revision_number: 2,
    revision_date: "2025-09-01",
    requires_acknowledgement: true,
    expiry_months: 12,
    active: true,
  },
  {
    id: "tp-alone",
    title: "Working Alone",
    description: "Check-in protocols and escalation.",
    tier: "high_risk",
    program_type: "course",
    category: "Safety",
    department_category: "",
    revision_number: 1,
    revision_date: "2025-06-20",
    requires_acknowledgement: true,
    expiry_months: 24,
    active: true,
  },
  {
    id: "tp-cust-svc",
    title: "Customer Service Standards",
    description: "Guest interaction and incident escalation.",
    tier: "general",
    program_type: "course",
    category: "Operations",
    department_category: "reception",
    revision_number: 1,
    revision_date: "2025-04-01",
    requires_acknowledgement: false,
    expiry_months: null,
    active: true,
  },
];

export const MOCK_TRAINING_EMPLOYEES: TrainingEmployee[] = [
  { id: "emp-bw", display_name: "Blake Wilson", department: "Aquatics", supervisor_name: "Sam Rivera" },
  { id: "emp-dh", display_name: "Dana Hughes", department: "Aquatics", supervisor_name: "Sam Rivera" },
  { id: "emp-nj", display_name: "Noah Jones", department: "Maintenance", supervisor_name: "Jordan Lee" },
  { id: "emp-ak", display_name: "Alex Kim", department: "Front desk", supervisor_name: "Jordan Lee" },
  { id: "emp-mr", display_name: "Morgan Reid", department: "Aquatics", supervisor_name: "Sam Rivera" },
];

function assign(
  partial: Omit<TrainingAssignment, "id"> & { id?: string },
): TrainingAssignment {
  return {
    id: partial.id ?? `ta-${partial.employee_id}-${partial.training_program_id}`,
    ...partial,
  };
}

/** Seed assignments — varied statuses for UI testing */
export const MOCK_TRAINING_ASSIGNMENTS: TrainingAssignment[] = [
  assign({
    employee_id: "emp-bw",
    training_program_id: "tp-orientation",
    assigned_by: "supervisor-1",
    assigned_date: "2026-01-05",
    due_date: "2026-01-20",
    status: "completed",
    completed_date: "2026-01-12",
    expiry_date: null,
    acknowledgement_date: "2026-01-12T15:00:00",
    supervisor_signoff: true,
  }),
  assign({
    employee_id: "emp-bw",
    training_program_id: "tp-whmis",
    assigned_by: "supervisor-1",
    assigned_date: "2026-01-12",
    due_date: "2026-02-01",
    status: "expiring_soon",
    completed_date: "2023-05-10",
    expiry_date: "2026-06-01",
    acknowledgement_date: "2023-05-10T10:00:00",
    supervisor_signoff: true,
  }),
  assign({
    employee_id: "emp-bw",
    training_program_id: "tp-pool-chem",
    assigned_by: "supervisor-1",
    assigned_date: "2026-02-01",
    due_date: "2026-03-01",
    status: "completed",
    completed_date: "2026-02-15",
    expiry_date: "2027-02-15",
    acknowledgement_date: "2026-02-15T14:00:00",
    supervisor_signoff: true,
  }),
  assign({
    employee_id: "emp-bw",
    training_program_id: "tp-loto",
    assigned_by: "supervisor-1",
    assigned_date: "2026-02-01",
    due_date: "2026-03-15",
    status: "pending",
    completed_date: null,
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
  }),
  assign({
    employee_id: "emp-bw",
    training_program_id: "tp-alone",
    assigned_by: null,
    assigned_date: "2026-01-01",
    due_date: null,
    status: "not_assigned",
    completed_date: null,
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
  }),
  assign({
    employee_id: "emp-bw",
    training_program_id: "tp-cust-svc",
    assigned_by: "supervisor-1",
    assigned_date: "2026-01-05",
    due_date: null,
    status: "completed",
    completed_date: "2026-01-08",
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
  }),

  assign({
    employee_id: "emp-dh",
    training_program_id: "tp-orientation",
    assigned_by: "supervisor-1",
    assigned_date: "2026-04-01",
    due_date: "2026-04-15",
    status: "pending",
    completed_date: null,
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
  }),
  assign({
    employee_id: "emp-dh",
    training_program_id: "tp-whmis",
    assigned_by: "supervisor-1",
    assigned_date: "2025-01-01",
    due_date: "2025-02-01",
    status: "expired",
    completed_date: "2019-03-01",
    expiry_date: "2025-03-01",
    acknowledgement_date: "2019-03-01T09:00:00",
    supervisor_signoff: true,
  }),
  assign({
    employee_id: "emp-dh",
    training_program_id: "tp-pool-chem",
    assigned_by: "supervisor-1",
    assigned_date: "2026-03-01",
    due_date: "2026-04-01",
    status: "completed",
    completed_date: "2026-03-20",
    expiry_date: "2027-03-20",
    acknowledgement_date: "2026-03-20T11:00:00",
    supervisor_signoff: true,
  }),
  assign({
    employee_id: "emp-dh",
    training_program_id: "tp-loto",
    assigned_by: "supervisor-1",
    assigned_date: "2026-03-01",
    due_date: "2026-05-01",
    status: "pending",
    completed_date: null,
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
  }),
  assign({
    employee_id: "emp-dh",
    training_program_id: "tp-alone",
    assigned_by: "supervisor-1",
    assigned_date: "2026-03-01",
    due_date: "2026-05-01",
    status: "expiring_soon",
    completed_date: "2024-05-01",
    expiry_date: "2026-05-15",
    acknowledgement_date: "2024-05-01T08:00:00",
    supervisor_signoff: true,
  }),
  assign({
    employee_id: "emp-dh",
    training_program_id: "tp-cust-svc",
    assigned_by: null,
    assigned_date: "2026-01-01",
    due_date: null,
    status: "not_assigned",
    completed_date: null,
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
  }),

  assign({
    employee_id: "emp-nj",
    training_program_id: "tp-orientation",
    assigned_by: "supervisor-2",
    assigned_date: "2025-06-01",
    due_date: "2025-06-15",
    status: "completed",
    completed_date: "2025-06-10",
    expiry_date: null,
    acknowledgement_date: "2025-06-10T16:00:00",
    supervisor_signoff: true,
  }),
  assign({
    employee_id: "emp-nj",
    training_program_id: "tp-whmis",
    assigned_by: "supervisor-2",
    assigned_date: "2025-06-10",
    due_date: "2025-07-01",
    status: "completed",
    completed_date: "2025-06-28",
    expiry_date: "2028-06-28",
    acknowledgement_date: "2025-06-28T12:00:00",
    supervisor_signoff: true,
  }),
  assign({
    employee_id: "emp-nj",
    training_program_id: "tp-pool-chem",
    assigned_by: "supervisor-2",
    assigned_date: "2026-01-01",
    due_date: "2026-02-01",
    status: "expired",
    completed_date: "2024-01-15",
    expiry_date: "2025-01-15",
    acknowledgement_date: "2024-01-15T09:00:00",
    supervisor_signoff: true,
  }),
  assign({
    employee_id: "emp-nj",
    training_program_id: "tp-loto",
    assigned_by: "supervisor-2",
    assigned_date: "2026-02-01",
    due_date: "2026-03-01",
    status: "completed",
    completed_date: "2026-02-28",
    expiry_date: "2027-02-28",
    acknowledgement_date: "2026-02-28T13:00:00",
    supervisor_signoff: true,
  }),
  assign({
    employee_id: "emp-nj",
    training_program_id: "tp-alone",
    assigned_by: "supervisor-2",
    assigned_date: "2026-02-01",
    due_date: "2026-03-01",
    status: "revision_pending",
    completed_date: "2025-01-01",
    expiry_date: "2027-01-01",
    acknowledgement_date: "2025-01-01T10:00:00",
    supervisor_signoff: true,
  }),
  assign({
    employee_id: "emp-nj",
    training_program_id: "tp-cust-svc",
    assigned_by: "supervisor-2",
    assigned_date: "2025-06-01",
    due_date: null,
    status: "completed",
    completed_date: "2025-06-05",
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
  }),

  assign({
    employee_id: "emp-ak",
    training_program_id: "tp-orientation",
    assigned_by: "supervisor-2",
    assigned_date: "2026-05-01",
    due_date: "2026-05-20",
    status: "pending",
    completed_date: null,
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
  }),
  assign({
    employee_id: "emp-ak",
    training_program_id: "tp-whmis",
    assigned_by: "supervisor-2",
    assigned_date: "2026-05-01",
    due_date: "2026-06-01",
    status: "pending",
    completed_date: null,
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
  }),
  assign({
    employee_id: "emp-ak",
    training_program_id: "tp-pool-chem",
    assigned_by: null,
    assigned_date: "2026-01-01",
    due_date: null,
    status: "not_assigned",
    completed_date: null,
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
  }),
  assign({
    employee_id: "emp-ak",
    training_program_id: "tp-loto",
    assigned_by: null,
    assigned_date: "2026-01-01",
    due_date: null,
    status: "not_assigned",
    completed_date: null,
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
  }),
  assign({
    employee_id: "emp-ak",
    training_program_id: "tp-alone",
    assigned_by: null,
    assigned_date: "2026-01-01",
    due_date: null,
    status: "not_assigned",
    completed_date: null,
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
  }),
  assign({
    employee_id: "emp-ak",
    training_program_id: "tp-cust-svc",
    assigned_by: "supervisor-2",
    assigned_date: "2026-05-01",
    due_date: "2026-05-30",
    status: "completed",
    completed_date: "2026-05-12",
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
  }),

  assign({
    employee_id: "emp-mr",
    training_program_id: "tp-orientation",
    assigned_by: "supervisor-1",
    assigned_date: "2026-02-01",
    due_date: "2026-02-15",
    status: "completed",
    completed_date: "2026-02-10",
    expiry_date: null,
    acknowledgement_date: "2026-02-10T09:30:00",
    supervisor_signoff: true,
  }),
  assign({
    employee_id: "emp-mr",
    training_program_id: "tp-whmis",
    assigned_by: "supervisor-1",
    assigned_date: "2026-02-10",
    due_date: "2026-03-01",
    status: "completed",
    completed_date: "2026-02-25",
    expiry_date: "2029-02-25",
    acknowledgement_date: "2026-02-25T14:00:00",
    supervisor_signoff: true,
  }),
  assign({
    employee_id: "emp-mr",
    training_program_id: "tp-pool-chem",
    assigned_by: "supervisor-1",
    assigned_date: "2026-03-01",
    due_date: "2026-04-01",
    status: "revision_pending",
    completed_date: "2025-08-01",
    expiry_date: "2026-08-01",
    acknowledgement_date: "2025-08-01T11:00:00",
    supervisor_signoff: true,
  }),
  assign({
    employee_id: "emp-mr",
    training_program_id: "tp-loto",
    assigned_by: "supervisor-1",
    assigned_date: "2026-03-01",
    due_date: "2026-04-15",
    status: "pending",
    completed_date: null,
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
  }),
  assign({
    employee_id: "emp-mr",
    training_program_id: "tp-alone",
    assigned_by: "supervisor-1",
    assigned_date: "2026-03-01",
    due_date: "2026-04-15",
    status: "pending",
    completed_date: null,
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
  }),
  assign({
    employee_id: "emp-mr",
    training_program_id: "tp-cust-svc",
    assigned_by: "supervisor-1",
    assigned_date: "2026-02-01",
    due_date: null,
    status: "completed",
    completed_date: "2026-02-05",
    expiry_date: null,
    acknowledgement_date: null,
    supervisor_signoff: false,
  }),
];

/** Acknowledgements — Noah's working alone completed under rev 0; program now rev 1 → revision pending via helper */
export const MOCK_TRAINING_ACKNOWLEDGEMENTS: TrainingAcknowledgement[] = [
  {
    id: "ack-nj-alone",
    employee_id: "emp-nj",
    training_program_id: "tp-alone",
    revision_number: 0,
    acknowledged_at: "2025-01-01T10:00:00",
  },
  {
    id: "ack-mr-pool",
    employee_id: "emp-mr",
    training_program_id: "tp-pool-chem",
    revision_number: 3,
    acknowledged_at: "2025-08-01T11:00:00",
  },
];

export function latestAcknowledgement(
  employeeId: string,
  programId: string,
  acks: TrainingAcknowledgement[],
): TrainingAcknowledgement | undefined {
  return acks
    .filter((a) => a.employee_id === employeeId && a.training_program_id === programId)
    .sort((a, b) => b.revision_number - a.revision_number)[0];
}

/**
 * Effective cell status: merges stored assignment status with revision rules.
 */
export function effectiveAssignmentStatus(
  program: TrainingProgram,
  assignment: TrainingAssignment | undefined,
  acks: TrainingAcknowledgement[],
): TrainingAssignmentStatus {
  if (!assignment || assignment.status === "not_assigned") return "not_assigned";
  if (assignment.status === "not_applicable") return "not_applicable";
  const latest = latestAcknowledgement(assignment.employee_id, program.id, acks);
  if (
    isRevisionPendingForAssignment(program, assignment, latest) &&
    assignment.status !== "pending" &&
    assignment.status !== "expired"
  ) {
    return "revision_pending";
  }
  return assignment.status;
}

/**
 * When assignments carry authoritative `status` from the API, skip client-side revision re-derivation
 * so filters and badges match the server.
 */
export function cellAssignmentStatus(
  program: TrainingProgram,
  assignment: TrainingAssignment | undefined,
  acks: TrainingAcknowledgement[],
  opts?: { trustAssignmentStatus?: boolean },
): TrainingAssignmentStatus {
  const ov = assignment?.matrix_admin_override;
  if (!opts?.trustAssignmentStatus) {
    if (ov === "force_complete") return "completed";
    if (ov === "force_incomplete") return "pending";
    if (ov === "force_na") return "not_applicable";
  }
  if (opts?.trustAssignmentStatus && assignment && assignment.status !== "not_assigned") {
    return assignment.status;
  }
  return effectiveAssignmentStatus(program, assignment, acks);
}

/** Assignments adjusted for demo revision_pending where applicable */
export function resolvedAssignments(
  programs: TrainingProgram[],
  assignments: TrainingAssignment[],
  acks: TrainingAcknowledgement[],
): TrainingAssignment[] {
  const pmap = new Map(programs.map((p) => [p.id, p]));
  return assignments.map((a) => {
    const p = pmap.get(a.training_program_id);
    if (!p) return a;
    const eff = effectiveAssignmentStatus(p, a, acks);
    if (eff === a.status) return a;
    return { ...a, status: eff };
  });
}

export const MOCK_RESOLVED_ASSIGNMENTS = resolvedAssignments(
  MOCK_TRAINING_PROGRAMS,
  MOCK_TRAINING_ASSIGNMENTS,
  MOCK_TRAINING_ACKNOWLEDGEMENTS,
);
