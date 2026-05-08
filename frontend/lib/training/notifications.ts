/**
 * Notification hooks — placeholders for future push/email/Teams integration.
 * Call these from assignment mutations / cron boundaries when backend exists.
 */

import type { TrainingAssignment, TrainingProgram } from "./types";

export type TrainingNotificationKind =
  | "certification_expiring"
  | "mandatory_overdue"
  | "training_newly_assigned"
  | "revision_acknowledgement_required"
  | "leadership_mandatory_overdue"
  | "leadership_high_risk_expired"
  | "leadership_onboarding_missing";

export type TrainingNotificationPayload = {
  kind: TrainingNotificationKind;
  employeeId: string;
  programId: string;
  /** ISO dates for audit context */
  dueDate?: string | null;
  expiryDate?: string | null;
  revisionNumber?: number;
  meta?: Record<string, string | number | boolean | null>;
};

/** Register a handler (e.g. in app bootstrap) to fan out to real channels later */
type Handler = (payload: TrainingNotificationPayload) => void;
let _handler: Handler | null = null;

export function registerTrainingNotificationHandler(handler: Handler | null): void {
  _handler = handler;
}

export function emitTrainingNotification(payload: TrainingNotificationPayload): void {
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console -- intentional dev placeholder
    console.debug("[training:notify]", payload.kind, payload);
  }
  _handler?.(payload);
}

export function notifyCertificationExpiring(
  employeeId: string,
  program: Pick<TrainingProgram, "id" | "title">,
  expiryDate: string | null,
): void {
  emitTrainingNotification({
    kind: "certification_expiring",
    employeeId,
    programId: program.id,
    expiryDate,
    meta: { title: program.title },
  });
}

export function notifyMandatoryOverdue(employeeId: string, programId: string, dueDate: string | null): void {
  emitTrainingNotification({
    kind: "mandatory_overdue",
    employeeId,
    programId,
    dueDate,
  });
}

export function notifyNewlyAssignedTraining(employeeId: string, programId: string, assignedDate: string): void {
  emitTrainingNotification({
    kind: "training_newly_assigned",
    employeeId,
    programId,
    meta: { assignedDate },
  });
}

export function notifyRevisionAcknowledgementRequired(
  employeeId: string,
  programId: string,
  revisionNumber: number,
): void {
  emitTrainingNotification({
    kind: "revision_acknowledgement_required",
    employeeId,
    programId,
    revisionNumber,
  });
}

/** Leadership / supervisor rollup placeholders */
export function notifyLeadershipMandatoryOverdue(summary: { employeeId: string; programId: string }): void {
  emitTrainingNotification({
    kind: "leadership_mandatory_overdue",
    employeeId: summary.employeeId,
    programId: summary.programId,
  });
}

export function notifyLeadershipHighRiskExpired(summary: { employeeId: string; programId: string }): void {
  emitTrainingNotification({
    kind: "leadership_high_risk_expired",
    employeeId: summary.employeeId,
    programId: summary.programId,
  });
}

export function notifyLeadershipOnboardingMissing(employeeId: string): void {
  emitTrainingNotification({
    kind: "leadership_onboarding_missing",
    employeeId,
    programId: "onboarding",
  });
}
