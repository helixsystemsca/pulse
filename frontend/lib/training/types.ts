/**
 * Workforce training & compliance — domain types.
 * Designed for future HR / SSO / SAP integrations (not wired yet).
 */

export type TrainingTier = "mandatory" | "high_risk" | "general";

/** Company-admin matrix display override (stored on assignment row). */
export type MatrixAdminOverride = "force_complete" | "force_incomplete";

/** Assignment lifecycle + compliance states shown in matrix cells */
export type TrainingAssignmentStatus =
  | "completed"
  | "expiring_soon"
  | "expired"
  | "pending"
  | "revision_pending"
  | "not_assigned"
  | "in_progress"
  | "acknowledged"
  | "quiz_failed";

export type TrainingProgram = {
  id: string;
  title: string;
  description: string;
  tier: TrainingTier;
  category: string;
  revision_number: number;
  revision_date: string; // ISO date
  requires_acknowledgement: boolean;
  /** When true (default), completion requires read → acknowledge → 100% quiz. */
  requires_knowledge_verification?: boolean;
  /** Months until certification expires after completion; null = non-expiring */
  expiry_months: number | null;
  /** Optional compliance window: mandatory items should be complete within this many days of assignment. */
  due_within_days?: number | null;
  active: boolean;
};

export type TrainingAssignment = {
  id: string;
  employee_id: string;
  training_program_id: string;
  assigned_by: string | null;
  assigned_date: string; // ISO date
  due_date: string | null; // ISO date
  status: TrainingAssignmentStatus;
  completed_date: string | null;
  expiry_date: string | null;
  acknowledgement_date: string | null;
  supervisor_signoff: boolean;
  /** Manager visibility — verification quiz attempts for current revision */
  quiz_attempt_count?: number;
  quiz_latest_score_percent?: number | null;
  quiz_latest_passed?: boolean | null;
  /** Current revision — first time worker opened verification-tracked procedure view */
  verification_first_viewed_at?: string | null;
  verification_last_viewed_at?: string | null;
  verification_total_view_seconds?: number;
  /** When perfect-score knowledge verification was recorded for current revision */
  quiz_passed_at?: string | null;
  /** When set, matrix shows completed or not-complete regardless of verification pipeline until cleared. */
  matrix_admin_override?: MatrixAdminOverride | null;
};

export type TrainingAcknowledgement = {
  id: string;
  employee_id: string;
  training_program_id: string;
  revision_number: number;
  acknowledged_at: string; // ISO datetime
};

/** Minimal roster row for matrix rows / filters (demo or API-shaped later) */
export type TrainingEmployee = {
  id: string;
  display_name: string;
  department: string;
  /** Supervisor visibility — name for display */
  supervisor_name?: string | null;
};
