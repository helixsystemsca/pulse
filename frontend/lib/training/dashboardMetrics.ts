import type {
  TrainingAcknowledgement,
  TrainingAssignment,
  TrainingAssignmentStatus,
  TrainingEmployee,
  TrainingProgram,
} from "./types";
import { cellAssignmentStatus, resolvedAssignments } from "./mockData";
import { assignmentFor, computeComplianceSummary } from "./selectors";
import { formatLabelTitleCase, formatTrainingRoleDisplay } from "./trainingRoleDisplay";

export type TrainingDashboardTab = "overview" | "employees" | "matrix" | "expiring" | "reports";

export type DashboardComplianceFilter =
  | "all"
  | "compliant"
  | "missing_mandatory"
  | "expired"
  | "in_progress";

export type WorkerTrainingMeta = {
  role: string;
  shift: string | null;
};

export type TrainingDashboardFilters = {
  search: string;
  department: string;
  role: string;
  shift: string;
  complianceFilter: DashboardComplianceFilter;
  trainingCategory: string;
  highRiskOnly: boolean;
};

export type RowAccent = "compliant" | "expiring" | "risk";

export type HighRiskRollup = "compliant" | "missing" | "expired";

export type EmployeeComplianceRowModel = {
  employee: TrainingEmployee;
  roleLabel: string;
  shiftLabel: string;
  mandatoryDone: number;
  mandatoryTotal: number;
  mandatoryPct: number;
  mandatoryLabel: string;
  highRisk: HighRiskRollup;
  expiringSoonCount: number;
  nearestExpiry: string | null;
  lastActivityLabel: string | null;
  lastActivityIso: string | null;
  rowAccent: RowAccent;
  hasExpired: boolean;
  hasInProgress: boolean;
};

export type DashboardKpis = {
  totalEmployees: number;
  fullyCompliant: number;
  missingMandatoryEmployees: number;
  expiringSoonEmployees: number;
  highRiskGaps: number;
};

export type MatrixCategoryId = "mandatory" | "equipment" | "seasonal" | "general";

export type MatrixCategoryGroup = {
  id: MatrixCategoryId;
  label: string;
  programs: TrainingProgram[];
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** UI grouping for matrix columns — not persisted on the program. */
export function matrixCategoryForProgram(p: TrainingProgram): MatrixCategoryId {
  if (p.tier === "mandatory") return "mandatory";
  if (p.tier === "high_risk") return "equipment";
  const c = norm(p.category);
  if (c.includes("season") || c.includes("summer") || c.includes("winter") || c.includes("holiday")) {
    return "seasonal";
  }
  return "general";
}

export function groupProgramsForMatrix(programs: TrainingProgram[]): MatrixCategoryGroup[] {
  const active = programs.filter((p) => p.active);
  const buckets: Record<MatrixCategoryId, TrainingProgram[]> = {
    mandatory: [],
    equipment: [],
    seasonal: [],
    general: [],
  };
  for (const p of active) {
    buckets[matrixCategoryForProgram(p)].push(p);
  }
  const order: MatrixCategoryId[] = ["mandatory", "equipment", "seasonal", "general"];
  const labels: Record<MatrixCategoryId, string> = {
    mandatory: "Routines",
    equipment: "Equipment & high risk",
    seasonal: "Seasonal",
    general: "General",
  };
  return order
    .map((id) => ({ id, label: labels[id], programs: buckets[id] }))
    .filter((g) => g.programs.length > 0);
}

function effectiveStatus(
  p: TrainingProgram,
  a: TrainingAssignment | undefined,
  acks: TrainingAcknowledgement[],
  opts?: { trustAssignmentStatus?: boolean },
): TrainingAssignmentStatus {
  return cellAssignmentStatus(p, a, acks, opts);
}

function isMandatoryGap(status: TrainingAssignmentStatus): boolean {
  if (status === "completed" || status === "expiring_soon" || status === "not_applicable") return false;
  return true;
}

function highRiskRollupForEmployee(
  employeeId: string,
  highRiskPrograms: TrainingProgram[],
  resolved: TrainingAssignment[],
  acks: TrainingAcknowledgement[],
  opts?: { trustAssignmentStatus?: boolean },
): HighRiskRollup {
  if (highRiskPrograms.length === 0) return "compliant";
  let expired = false;
  let missing = false;
  for (const p of highRiskPrograms) {
    const a = assignmentFor(employeeId, p.id, resolved);
    const eff = effectiveStatus(p, a, acks, opts);
    if (eff === "expired") expired = true;
    else if (eff !== "completed" && eff !== "expiring_soon" && eff !== "not_applicable") missing = true;
  }
  if (expired) return "expired";
  if (missing) return "missing";
  return "compliant";
}

function lastActivityIso(employeeId: string, programs: TrainingProgram[], resolved: TrainingAssignment[]): string | null {
  let best: string | null = null;
  const bump = (iso: string | null | undefined) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return;
    if (!best || t > new Date(best).getTime()) best = new Date(iso).toISOString();
  };
  for (const p of programs) {
    const a = assignmentFor(employeeId, p.id, resolved);
    if (!a) continue;
    bump(a.completed_date);
    bump(a.verification_last_viewed_at);
    bump(a.quiz_passed_at);
    bump(a.acknowledgement_date);
  }
  return best;
}

function formatRelativeOrDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const now = Date.now();
  const diffDays = Math.round((now - d.getTime()) / (86400 * 1000));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 14) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function buildEmployeeComplianceRows(
  employees: TrainingEmployee[],
  programs: TrainingProgram[],
  assignments: TrainingAssignment[],
  acknowledgements: TrainingAcknowledgement[],
  workerMeta: Record<string, WorkerTrainingMeta | undefined>,
  opts?: { trustAssignmentStatus?: boolean },
): EmployeeComplianceRowModel[] {
  const resolved = opts?.trustAssignmentStatus
    ? assignments
    : resolvedAssignments(programs, assignments, acknowledgements);
  const mandatory = programs.filter((p) => p.tier === "mandatory" && p.active);
  const highRisk = programs.filter((p) => p.tier === "high_risk" && p.active);
  const activePrograms = programs.filter((p) => p.active);

  return employees.map((employee) => {
    const eid = employee.id;
    let mandatoryDone = 0;
    let anyExpiring = false;
    let mandatoryGap = false;
    const expiryDates: string[] = [];

    for (const p of mandatory) {
      const a = assignmentFor(eid, p.id, resolved);
      const eff = effectiveStatus(p, a, acknowledgements, opts);
      if (eff === "completed" || eff === "expiring_soon" || eff === "not_applicable") mandatoryDone++;
      if (isMandatoryGap(eff)) mandatoryGap = true;
      if (eff === "expiring_soon") anyExpiring = true;
    }

    const mandatoryTotal = mandatory.length;
    const mandatoryPct =
      mandatoryTotal === 0 ? 100 : Math.round((mandatoryDone / mandatoryTotal) * 100);

    for (const p of activePrograms) {
      const a = assignmentFor(eid, p.id, resolved);
      const eff = effectiveStatus(p, a, acknowledgements, opts);
      if (eff === "expiring_soon" && a?.expiry_date) expiryDates.push(a.expiry_date);
    }

    const highRiskStatus = highRiskRollupForEmployee(eid, highRisk, resolved, acknowledgements, opts);

    let expiringSoonCount = 0;
    for (const p of activePrograms) {
      const a = assignmentFor(eid, p.id, resolved);
      const eff = effectiveStatus(p, a, acknowledgements, opts);
      if (eff === "expiring_soon") expiringSoonCount++;
    }

    expiryDates.sort();
    const nearestExpiry = expiryDates[0] ?? null;

    const lastIso = lastActivityIso(eid, activePrograms, resolved);
    const meta = workerMeta[eid];
    const roleLabel = formatTrainingRoleDisplay(meta?.role);
    const shiftLabel = meta?.shift?.trim() ? formatLabelTitleCase(meta.shift.trim()) : "—";

    let rowAccent: RowAccent = "compliant";
    if (mandatoryGap) rowAccent = "risk";
    else if (anyExpiring) rowAccent = "expiring";

    let hasExpired = false;
    let hasInProgress = false;
    for (const p of activePrograms) {
      const a = assignmentFor(eid, p.id, resolved);
      const eff = effectiveStatus(p, a, acknowledgements, opts);
      if (eff === "expired") hasExpired = true;
      if (eff === "in_progress" || eff === "acknowledged" || eff === "quiz_failed") hasInProgress = true;
    }

    return {
      employee,
      roleLabel,
      shiftLabel,
      mandatoryDone,
      mandatoryTotal,
      mandatoryPct,
      mandatoryLabel: mandatoryTotal === 0 ? "—" : `${mandatoryDone} / ${mandatoryTotal} complete`,
      highRisk: highRiskStatus,
      expiringSoonCount,
      nearestExpiry,
      lastActivityLabel: formatRelativeOrDate(lastIso),
      lastActivityIso: lastIso,
      rowAccent,
      hasExpired,
      hasInProgress,
    };
  });
}

export function computeDashboardKpis(
  employees: TrainingEmployee[],
  programs: TrainingProgram[],
  assignments: TrainingAssignment[],
  acknowledgements: TrainingAcknowledgement[],
  opts?: { trustAssignmentStatus?: boolean },
): DashboardKpis {
  const summary = computeComplianceSummary(employees, programs, assignments, acknowledgements, opts);
  const rows = buildEmployeeComplianceRows(employees, programs, assignments, acknowledgements, {}, opts);
  const missingMandatoryEmployees = rows.filter((r) => r.rowAccent === "risk").length;
  const expiringSoonEmployees = rows.filter((r) => r.expiringSoonCount > 0).length;
  return {
    totalEmployees: summary.totalEmployees,
    fullyCompliant: summary.fullyCompliant,
    missingMandatoryEmployees,
    expiringSoonEmployees,
    highRiskGaps: summary.highRiskOverdue,
  };
}

function employeeMatchesCategory(
  employeeId: string,
  category: string,
  programs: TrainingProgram[],
  resolved: TrainingAssignment[],
): boolean {
  const cats = programs.filter((p) => p.active && norm(p.category) === norm(category));
  if (cats.length === 0) return false;
  return cats.some((p) => {
    const a = assignmentFor(employeeId, p.id, resolved);
    return Boolean(a && a.status !== "not_assigned");
  });
}

export function uniqueProgramCategories(programs: TrainingProgram[]): string[] {
  const s = new Set<string>();
  for (const p of programs) {
    const c = p.category?.trim();
    if (c) s.add(c);
  }
  return [...s].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function filterDashboardEmployees(
  rows: EmployeeComplianceRowModel[],
  filters: TrainingDashboardFilters,
  programs: TrainingProgram[],
  assignments: TrainingAssignment[],
  acknowledgements: TrainingAcknowledgement[],
  opts?: { trustAssignmentStatus?: boolean },
): EmployeeComplianceRowModel[] {
  const resolved = opts?.trustAssignmentStatus
    ? assignments
    : resolvedAssignments(programs, assignments, acknowledgements);

  let out = rows;

  if (filters.department !== "all") {
    out = out.filter((r) => r.employee.department === filters.department);
  }

  if (filters.role !== "all") {
    out = out.filter((r) => norm(r.roleLabel) === norm(filters.role));
  }

  if (filters.shift !== "all") {
    out = out.filter((r) => norm(r.shiftLabel) === norm(filters.shift));
  }

  if (filters.trainingCategory !== "all") {
    out = out.filter((r) =>
      employeeMatchesCategory(r.employee.id, filters.trainingCategory, programs, resolved),
    );
  }

  if (filters.highRiskOnly) {
    out = out.filter((r) => r.highRisk !== "compliant");
  }

  const q = norm(filters.search);
  if (q) {
    out = out.filter(
      (r) =>
        norm(r.employee.display_name).includes(q) ||
        norm(r.employee.department).includes(q) ||
        norm(r.roleLabel).includes(q),
    );
  }

  switch (filters.complianceFilter) {
    case "compliant":
      out = out.filter((r) => r.rowAccent === "compliant");
      break;
    case "missing_mandatory":
      out = out.filter((r) => r.rowAccent === "risk");
      break;
    case "expired":
      out = out.filter((r) => r.hasExpired);
      break;
    case "in_progress":
      out = out.filter((r) => r.hasInProgress);
      break;
    default:
      break;
  }

  return out;
}

export type ExpiringRow = {
  employee: TrainingEmployee;
  program: TrainingProgram;
  expiryDate: string;
  status: TrainingAssignmentStatus;
};

export function buildExpiringSoonRows(
  employees: TrainingEmployee[],
  programs: TrainingProgram[],
  assignments: TrainingAssignment[],
  acknowledgements: TrainingAcknowledgement[],
  opts?: { trustAssignmentStatus?: boolean },
): ExpiringRow[] {
  const resolved = opts?.trustAssignmentStatus
    ? assignments
    : resolvedAssignments(programs, assignments, acknowledgements);
  const out: ExpiringRow[] = [];
  for (const e of employees) {
    for (const p of programs.filter((x) => x.active)) {
      const a = assignmentFor(e.id, p.id, resolved);
      const eff = effectiveStatus(p, a, acknowledgements, opts);
      if (eff !== "expiring_soon" || !a?.expiry_date) continue;
      out.push({ employee: e, program: p, expiryDate: a.expiry_date, status: eff });
    }
  }
  out.sort((x, y) => x.expiryDate.localeCompare(y.expiryDate));
  return out;
}

export type DrawerTrainingLine = {
  id: string;
  title: string;
  section: "mandatory" | "equipment" | "seasonal" | "general" | "quiz" | "expiring";
  status: TrainingAssignmentStatus;
  statusLabel: string;
  score: string | null;
  quizDetail: string | null;
  completedDate: string | null;
  expiryDate: string | null;
  assignedBy: string | null;
  needsRetrain: boolean;
};

const STATUS_LABEL: Record<TrainingAssignmentStatus, string> = {
  completed: "Complete",
  expiring_soon: "Expiring soon",
  expired: "Expired",
  pending: "Not started",
  revision_pending: "Revision pending",
  not_assigned: "Not assigned",
  in_progress: "In progress",
  acknowledged: "Acknowledged",
  quiz_failed: "Quiz retry",
  not_applicable: "Not applicable",
};

function drawerSectionForProgram(p: TrainingProgram): DrawerTrainingLine["section"] {
  const c = matrixCategoryForProgram(p);
  if (c === "mandatory") return "mandatory";
  if (c === "equipment") return "equipment";
  if (c === "seasonal") return "seasonal";
  return "general";
}

/** One row per active program; UI groups into Routines / Equipment / Seasonal / SOP & general / Quiz / Expiring. */
export function buildEmployeeDrawerLines(
  employeeId: string,
  programs: TrainingProgram[],
  assignments: TrainingAssignment[],
  acknowledgements: TrainingAcknowledgement[],
  opts?: { trustAssignmentStatus?: boolean },
): DrawerTrainingLine[] {
  const resolved = opts?.trustAssignmentStatus
    ? assignments
    : resolvedAssignments(programs, assignments, acknowledgements);
  const lines: DrawerTrainingLine[] = [];
  for (const p of programs.filter((x) => x.active)) {
    const a = assignmentFor(employeeId, p.id, resolved);
    const eff = effectiveStatus(p, a, acknowledgements, opts);
    const section = drawerSectionForProgram(p);
    const score =
      typeof a?.quiz_latest_score_percent === "number" ? `${a.quiz_latest_score_percent}%` : null;
    const attempts = a?.quiz_attempt_count ?? 0;
    const quizDetail =
      attempts > 0
        ? `${attempts} attempt${attempts === 1 ? "" : "s"}${score ? ` · latest ${score}` : ""}${
            typeof a?.quiz_latest_passed === "boolean" ? (a.quiz_latest_passed ? " · passed" : " · not passed") : ""
          }`
        : null;
    const needsRetrain = eff === "expired" || eff === "quiz_failed" || eff === "revision_pending";

    lines.push({
      id: p.id,
      title: p.title,
      section,
      status: eff,
      statusLabel: STATUS_LABEL[eff],
      score,
      quizDetail,
      completedDate: a?.completed_date ?? null,
      expiryDate: a?.expiry_date ?? null,
      assignedBy: a?.assigned_by ?? null,
      needsRetrain,
    });
  }
  return lines;
}
