import { cellAssignmentStatus } from "./mockData";
import { assignmentFor } from "./selectors";
import type { TrainingAcknowledgement, TrainingAssignment, TrainingAssignmentStatus, TrainingProgram } from "./types";

export type ComplianceAlertPriority = 1 | 2 | 3 | 4;

export type EmployeeComplianceAlert = {
  programId: string;
  title: string;
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
      priority: 1,
      label: "High-risk certification expired",
    };
  }

  if (program.tier === "mandatory") {
    if (eff === "not_assigned") {
      return {
        programId: program.id,
        title: program.title,
        priority: 2,
        label: "Routines training not assigned",
      };
    }
    if (eff === "expired") {
      return {
        programId: program.id,
        title: program.title,
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
          priority: 2,
          label: "Routines onboarding overdue",
        };
      }
    }
  }

  if (program.tier === "high_risk") {
    if (eff === "not_assigned") {
      return {
        programId: program.id,
        title: program.title,
        priority: 2,
        label: "High-risk training not assigned",
      };
    }
    if (eff === "pending" && assignment?.due_date) {
      const due = new Date(assignment.due_date);
      due.setHours(0, 0, 0, 0);
      if (due < today) {
        return {
          programId: program.id,
          title: program.title,
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
      priority: 3,
      label: "Revision acknowledgement required",
    };
  }

  if ((program.tier === "mandatory" || program.tier === "high_risk") && eff === "quiz_failed") {
    return {
      programId: program.id,
      title: program.title,
      priority: 3,
      label: "Knowledge check not passed — review procedure and retry",
    };
  }

  if (eff === "expiring_soon") {
    return { programId: program.id, title: program.title, priority: 4, label: "Expiring soon" };
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
    const eff = cellAssignmentStatus(p, a, acks, { trustAssignmentStatus: trustServer });
    const alert = rowAlert(p, eff, a);
    if (alert) out.push(alert);
  }
  out.sort((x, y) => {
    if (x.priority !== y.priority) return x.priority - y.priority;
    return x.title.localeCompare(y.title);
  });
  return out;
}
