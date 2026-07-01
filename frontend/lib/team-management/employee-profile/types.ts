import type { WorkerDetail } from "@/lib/workersService";
import type { WorkerDevelopmentDetail } from "@/lib/team-management/development-types";
import type { WorkerTrainingApiResponse } from "@/lib/trainingApi";

/** Full employee profile — single object for all Team Management features. */
export type EmployeeProfile = {
  userId: string;
  development: WorkerDevelopmentDetail;
  worker?: WorkerDetail | null;
  training?: WorkerTrainingApiResponse | null;
};

export type EmployeeProfileTab =
  | "overview"
  | "performance"
  | "development"
  | "training"
  | "career"
  | "recognition"
  | "history";

export type WorkerMeeting = {
  id: string;
  employee_user_id: string;
  employee_name?: string | null;
  manager_user_id?: string | null;
  manager_name?: string | null;
  meeting_type: string;
  scheduled_date?: string | null;
  status: string;
  agenda?: string | null;
  wins?: string | null;
  challenges?: string | null;
  goals?: string | null;
  manager_notes?: string | null;
  employee_notes?: string | null;
  next_meeting_date?: string | null;
  recurrence?: string | null;
  action_items: MeetingActionItem[];
  created_at: string;
  updated_at: string;
};

export type MeetingActionItem = {
  id: string;
  meeting_id?: string | null;
  employee_user_id: string;
  assigned_to_user_id?: string | null;
  assigned_to_name?: string | null;
  title: string;
  due_date?: string | null;
  status: string;
  notes?: string | null;
  project_id?: string | null;
};

export function normalizeDevelopmentDetail(d: WorkerDevelopmentDetail): WorkerDevelopmentDetail {
  return {
    ...d,
    career: d.career ?? {},
    recognitions: d.recognitions ?? [],
    unified_history:
      d.unified_history ??
      (d.history ?? []).map((h) => ({
        id: h.id,
        at: h.at,
        kind: h.kind,
        summary: h.summary,
        detail: h.detail,
        source: "development",
      })),
    plan_completion_pct: d.plan_completion_pct ?? 0,
  };
}

export function yearsOfService(startDate: string | null | undefined): string {
  if (!startDate) return "—";
  const start = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) return "—";
  const years = (Date.now() - start.getTime()) / (365.25 * 86_400_000);
  if (years < 1) return "< 1 year";
  return `${years.toFixed(1)} yrs`;
}

export function overallRating(assessment: WorkerDevelopmentDetail["assessment"]): number | null {
  const vals = [
    assessment.initiative,
    assessment.communication,
    assessment.leadership_potential,
    assessment.reliability,
    assessment.technical_skills,
  ].filter((v): v is number => typeof v === "number");
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}
