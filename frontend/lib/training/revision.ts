import type { TrainingAcknowledgement, TrainingAssignment, TrainingProgram } from "./types";

/**
 * After a program revision bump, acknowledgements below the new revision are outdated.
 */
export function acknowledgementCoversRevision(
  ack: TrainingAcknowledgement | undefined,
  programRevision: number,
): boolean {
  if (!ack) return false;
  return ack.revision_number >= programRevision;
}

/**
 * Derive whether an assignment should show "revision pending" for compliance UI.
 */
export function isRevisionPendingForAssignment(
  program: TrainingProgram,
  assignment: TrainingAssignment | undefined,
  latestAck: TrainingAcknowledgement | undefined,
): boolean {
  if (!program.active) return false;
  if (!assignment || assignment.status === "not_assigned") return false;
  if (assignment.status === "pending") return false;
  if (!assignment.completed_date) return false;
  if (!program.requires_acknowledgement) return false;
  return !acknowledgementCoversRevision(latestAck, program.revision_number);
}

/**
 * Pure helper to bump program revision (caller persists). Used when procedures update.
 */
export function nextProgramRevision(current: number): number {
  return current + 1;
}
