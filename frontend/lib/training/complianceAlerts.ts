import { cellAssignmentStatus } from "./mockData";
import { assignmentFor } from "./selectors";
import type {
  TrainingAcknowledgement,
  TrainingAssignment,
  TrainingAssignmentStatus,
  TrainingProgram,
  TrainingTier,
} from "./types";

export type ComplianceAlertPriority = 1 | 2 | 3 | 4;

/** Tiers shown in My Learning compliance attention (assigned gaps only). */
export const COMPLIANCE_ALERT_TIER_ORDER: readonly TrainingTier[] = ["mandatory", "high_risk"];

export type EmployeeComplianceAlert = {
  programId: string;
  title: string;
  tier: TrainingTier;
  priority: ComplianceAlertPriority;
  label: string;
};

function rowAlert(
  program: TrainingProgram,
  eff: TrainingAssignmentStatus,
  assignment: TrainingAssignment | undefined,
): EmployeeComplianceAlert | null {
  if (!program.active) return null;
  if (eff === "not_applicable") return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // General-tier items stay informational (table only).
  if (program.tier === "general") return null;

  if (program.tier === "high_risk" && eff === "expired") {
    return {
      programId: program.id,
      title: program.title,
      tier: program.tier,
      priority: 1,
      label: "High-risk certification expired",
    };
  }

  if (program.tier === "mandatory") {
    if (eff === "expired") {
      return {
        programId: program.id,
        title: program.title,
        tier: program.tier,
        priority: 2,
        label: "Routines certification expired",
      };
    }
    if (eff === "pending" && assignment?.due_date) {
      const due = new Date(assignment.due_date);
      due.setHours(0, 0, 0, 0);
      if (due < today) {
        return {
          programId: program.id,
          title: program.title,
          tier: program.tier,
          priority: 2,
          label: "Routines onboarding overdue",
        };
      }
    }
  }

  if (program.tier === "high_risk") {
    if (eff === "pending" && assignment?.due_date) {
      const due = new Date(assignment.due_date);
      due.setHours(0, 0, 0, 0);
      if (due < today) {
        return {
          programId: program.id,
          title: program.title,
          tier: program.tier,
          priority: 2,
          label: "High-risk training overdue",
        };
      }
    }
  }

  if (eff === "revision_pending") {
    return {
      programId: program.id,
      title: program.title,
      tier: program.tier,
      priority: 3,
      label: "Revision acknowledgement required",
    };
  }

  if ((program.tier === "mandatory" || program.tier === "high_risk") && eff === "quiz_failed") {
    return {
      programId: program.id,
      title: program.title,
      tier: program.tier,
      priority: 3,
      label: "Knowledge check not passed — review procedure and retry",
    };
  }

  if (eff === "expiring_soon") {
    return {
      programId: program.id,
      title: program.title,
      tier: program.tier,
      priority: 4,
      label: "Expiring soon",
    };
  }

  return null;
}

/** Ordered operational alerts for one employee (Standards → Training self-view strip). */
export function complianceAlertsForEmployee(
  employeeId: string,
  programs: TrainingProgram[],
  assignments: TrainingAssignment[],
  acks: TrainingAcknowledgement[],
  trustServer: boolean,
): EmployeeComplianceAlert[] {
  const out: EmployeeComplianceAlert[] = [];
  for (const p of programs) {
    const a = assignmentFor(employeeId, p.id, assignments);
    if (!a) continue;
    const eff = cellAssignmentStatus(p, a, acks, { trustAssignmentStatus: trustServer });
    if (eff === "not_assigned") continue;
    const alert = rowAlert(p, eff, a);
    if (alert) out.push(alert);
  }
  out.sort((x, y) => {
    const ti = COMPLIANCE_ALERT_TIER_ORDER.indexOf(x.tier);
    const tj = COMPLIANCE_ALERT_TIER_ORDER.indexOf(y.tier);
    if (ti !== tj) return ti - tj;
    if (x.priority !== y.priority) return x.priority - y.priority;
    return x.title.localeCompare(y.title);
  });
  return out;
}

export function complianceAlertsGroupedByTier(
  alerts: readonly EmployeeComplianceAlert[],
): { tier: TrainingTier; alerts: EmployeeComplianceAlert[] }[] {
  return COMPLIANCE_ALERT_TIER_ORDER.map((tier) => ({
    tier,
    alerts: alerts.filter((a) => a.tier === tier),
  })).filter((g) => g.alerts.length > 0);
}
