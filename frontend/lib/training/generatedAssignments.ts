import type { TrainingAcknowledgement, TrainingAssignment, TrainingAssignmentStatus, TrainingEmployee, TrainingProgram } from "./types";
import { effectiveAssignmentStatus } from "./mockData";
import { latestAcknowledgement } from "./mockData";

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Until a backend training/assignment table exists, generate deterministic demo assignments
 * for real employees + real procedures so the matrix stays usable.
 */
export function generateDemoAssignmentsForMatrix(
  employees: TrainingEmployee[],
  programs: TrainingProgram[],
): { assignments: TrainingAssignment[]; acknowledgements: TrainingAcknowledgement[] } {
  const assignments: TrainingAssignment[] = [];
  const acknowledgements: TrainingAcknowledgement[] = [];

  for (const e of employees) {
    for (const p of programs) {
      const h = hash32(`${e.id}:${p.id}`);
      const bucket = h % 100;

      let status: TrainingAssignmentStatus;
      if (bucket < 62) status = "completed";
      else if (bucket < 72) status = "pending";
      else if (bucket < 80) status = "expiring_soon";
      else if (bucket < 90) status = "revision_pending";
      else status = "expired";

      // Mandatory/high risk more likely assigned.
      // (We no longer generate \"not_assigned\" here; keep this branch in case we reintroduce it.)

      const assigned_date = isoDaysAgo(45 + (h % 25));
      const due_date = p.due_within_days != null ? isoDaysAgo(Math.max(0, 10 - (h % 12))) : null;
      const completed_date = status === "completed" || status === "expiring_soon" || status === "revision_pending" ? isoDaysAgo(20 + (h % 18)) : null;
      const expiry_date =
        status === "expiring_soon"
          ? isoDaysFromNow(14)
          : status === "expired"
            ? isoDaysAgo(15 + (h % 15))
            : null;

      const a: TrainingAssignment = {
        id: `gen-${e.id}-${p.id}`,
        employee_id: e.id,
        training_program_id: p.id,
        assigned_by: null,
        assigned_date,
        due_date,
        status,
        completed_date,
        expiry_date,
        acknowledgement_date: null,
        supervisor_signoff: status === "completed" && p.tier !== "general",
      };
      assignments.push(a);

      if (p.requires_acknowledgement && completed_date) {
        const ackRev = status === "revision_pending" ? Math.max(0, p.revision_number - 1) : p.revision_number;
        const ack: TrainingAcknowledgement = {
          id: `gen-ack-${e.id}-${p.id}`,
          employee_id: e.id,
          training_program_id: p.id,
          revision_number: ackRev,
          acknowledged_at: new Date(`${completed_date}T12:00:00Z`).toISOString(),
        };
        acknowledgements.push(ack);
      }
    }
  }

  // Resolve revision pending accurately.
  const acks = acknowledgements;
  const resolved = assignments.map((a) => {
    const p = programs.find((x) => x.id === a.training_program_id);
    if (!p) return a;
    const latest = latestAcknowledgement(a.employee_id, p.id, acks);
    const eff = effectiveAssignmentStatus(p, a, acks);
    // keep status as effective; acknowledgement remains as is
    void latest;
    if (eff === a.status) return a;
    return { ...a, status: eff };
  });

  return { assignments: resolved, acknowledgements };
}

