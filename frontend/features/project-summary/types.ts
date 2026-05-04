/** Mirrors `app.services.project_summary.schemas` (API JSON). */

export type OutcomeResult = "success" | "partial" | "fail";

export type SummaryOverview = {
  project_name: string;
  project_type: string;
  start_date?: string | null;
  end_date?: string | null;
  owner: string;
  success_flag?: boolean | null;
};

export type SummaryScope = {
  planned_tasks: number;
  completed_tasks: number;
  scope_changes: string[];
};

export type SummarySchedule = {
  planned_duration_days: number;
  actual_duration_days?: number | null;
  variance_days?: number | null;
  delayed_tasks: number;
};

export type SummaryLessons = {
  went_well: string;
  didnt_go_well: string;
  improvements: string;
};

export type SummaryOutcome = {
  result: OutcomeResult;
  summary: string;
};

export type ProjectSummaryDoc = {
  project_id: string;
  overview: SummaryOverview;
  scope: SummaryScope;
  schedule: SummarySchedule;
  lessons: SummaryLessons;
  outcome: SummaryOutcome;
};

export type ProjectSummaryStorageState = {
  has_draft: boolean;
  has_finalized: boolean;
};

export type ProjectSummaryStoredOut = {
  id: string;
  project_id: string;
  status: "draft" | "finalized";
  snapshot_json: Record<string, unknown>;
  metrics_json: Record<string, unknown>;
  user_inputs_json: Record<string, unknown>;
  created_at: string;
  finalized_at?: string | null;
};

export type ProjectSummaryUserInputs = {
  lessons?: Partial<SummaryLessons>;
  outcome?: Partial<SummaryOutcome>;
};
