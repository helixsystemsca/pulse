/**
 * Workforce training & compliance — domain types.
 * Designed for future HR / SSO / SAP integrations (not wired yet).
 */

export type TrainingTier = "mandatory" | "high_risk" | "general";

/** Assignment lifecycle + compliance states shown in matrix cells */
export type TrainingAssignmentStatus =
  | "completed"
  | "expiring_soon"
  | "expired"
  | "pending"
  | "revision_pending"
  | "not_assigned";

export type TrainingProgram = {
  id: string;
  title: string;
  description: string;
  tier: TrainingTier;
  category: string;
  revision_number: number;
  revision_date: string; // ISO date
  requires_acknowledgement: boolean;
  /** Months until certification expires after completion; null = non-expiring */
  expiry_months: number | null;
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
