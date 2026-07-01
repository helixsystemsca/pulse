/** Types and styling for Team Management → Development. */

export type DevelopmentQuadrant = "A" | "B" | "C" | "D";

export type DevelopmentStatus = "on_track" | "developing" | "needs_support" | "action_required";

export type DevelopmentAssessment = {
  strengths?: string | null;
  development_areas?: string | null;
  leadership_potential?: number | null;
  engagement?: number | null;
  reliability?: number | null;
  communication?: number | null;
  initiative?: number | null;
  technical_skills?: number | null;
  overall_summary?: string | null;
};

export type DevelopmentPlan = {
  objective?: string | null;
  quadrant?: DevelopmentQuadrant | null;
  generated_at?: string | null;
  milestones?: Record<string, string[]>;
  custom_notes?: string | null;
};

export type DevelopmentTimelineItem = {
  id: string;
  kind: string;
  title: string;
  scheduled_date?: string | null;
  status: string;
  notes?: string | null;
  attachments?: { name: string; url?: string }[];
};

export type DevelopmentHistoryItem = {
  id: string;
  at: string;
  kind: string;
  summary: string;
  detail?: string | null;
};

export type EmployeeCareerProfile = {
  desired_position?: string | null;
  leadership_interest?: string | null;
  promotion_readiness?: string | null;
  mentor_user_id?: string | null;
  mentor_name?: string | null;
  career_notes?: string | null;
};

export type EmployeeRecognition = {
  id: string;
  at: string;
  title: string;
  description?: string | null;
  awarded_by?: string | null;
  awarded_by_user_id?: string | null;
  category: string;
};

export type UnifiedHistoryItem = {
  id: string;
  at: string;
  kind: string;
  summary: string;
  detail?: string | null;
  source?: string;
};

export type RecognitionFeedItem = {
  id: string;
  user_id: string;
  employee_name: string;
  at: string;
  title: string;
  description?: string | null;
  category: string;
  awarded_by?: string | null;
};

export type WorkerDevelopmentSummary = {
  user_id: string;
  full_name: string | null;
  email: string;
  job_title: string | null;
  department: string | null;
  avatar_url: string | null;
  supervisor_id: string | null;
  supervisor_name: string | null;
  start_date: string | null;
  is_active: boolean;
  development_quadrant: DevelopmentQuadrant;
  development_status: DevelopmentStatus;
  last_assessment_at: string | null;
  next_review_date: string | null;
  assessment_summary: string | null;
  performance_score: number | null;
  potential_score: number | null;
  roster_skills: string[];
};

export type WorkerDevelopmentDetail = WorkerDevelopmentSummary & {
  manager_notes: string | null;
  career_goals: string | null;
  assessment: DevelopmentAssessment;
  development_plan: DevelopmentPlan;
  skills: string[];
  timeline: DevelopmentTimelineItem[];
  history: DevelopmentHistoryItem[];
  career: EmployeeCareerProfile;
  recognitions: EmployeeRecognition[];
  unified_history: UnifiedHistoryItem[];
  plan_completion_pct?: number;
  updated_at: string | null;
};

export type WorkerDevelopmentListResponse = {
  items: WorkerDevelopmentSummary[];
  last_updated_at: string | null;
};

export type WorkerDevelopmentPatch = {
  development_quadrant?: DevelopmentQuadrant;
  development_status?: DevelopmentStatus;
  manager_notes?: string | null;
  career_goals?: string | null;
  skills?: string[];
  assessment?: DevelopmentAssessment;
  development_plan?: DevelopmentPlan;
  timeline?: DevelopmentTimelineItem[];
  career?: EmployeeCareerProfile;
  add_recognition?: {
    title: string;
    description?: string | null;
    category?: string;
    awarded_by?: string | null;
  };
  confirm_plan_overwrite?: boolean;
  record_assessment?: boolean;
};

export type WorkerDevelopmentPatchResponse = {
  detail: WorkerDevelopmentDetail;
  plan_overwrite_required: boolean;
  message?: string | null;
};

export const QUADRANT_META: Record<
  DevelopmentQuadrant,
  {
    label: string;
    shortLabel: string;
    matrixPosition: "top-right" | "top-left" | "bottom-right" | "bottom-left";
    bgClass: string;
    borderClass: string;
    badgeClass: string;
    textClass: string;
    barClass: string;
  }
> = {
  A: {
    label: "High Performer",
    shortLabel: "A",
    matrixPosition: "top-right",
    bgClass: "bg-[#E6F4EA] dark:bg-emerald-950/40",
    borderClass: "border-[#1E8E3E]/25",
    badgeClass: "bg-[#E6F4EA] text-[#1E8E3E] dark:bg-emerald-950/50 dark:text-emerald-300",
    textClass: "text-[#1E8E3E] dark:text-emerald-300",
    barClass: "bg-[#1E8E3E]",
  },
  B: {
    label: "Solid Contributor",
    shortLabel: "B",
    matrixPosition: "bottom-right",
    bgClass: "bg-[#E8F0FE] dark:bg-sky-950/40",
    borderClass: "border-[#1A73E8]/25",
    badgeClass: "bg-[#E8F0FE] text-[#1A73E8] dark:bg-sky-950/50 dark:text-sky-300",
    textClass: "text-[#1A73E8] dark:text-sky-300",
    barClass: "bg-[#1A73E8]",
  },
  C: {
    label: "Developing",
    shortLabel: "C",
    matrixPosition: "top-left",
    bgClass: "bg-[#FEF7E0] dark:bg-amber-950/35",
    borderClass: "border-[#F9AB00]/30",
    badgeClass: "bg-[#FEF7E0] text-[#B06000] dark:bg-amber-950/50 dark:text-amber-200",
    textClass: "text-[#B06000] dark:text-amber-200",
    barClass: "bg-[#F9AB00]",
  },
  D: {
    label: "Needs Improvement",
    shortLabel: "D",
    matrixPosition: "bottom-left",
    bgClass: "bg-[#FCE8E6] dark:bg-rose-950/35",
    borderClass: "border-[#D93025]/25",
    badgeClass: "bg-[#FCE8E6] text-[#D93025] dark:bg-rose-950/50 dark:text-rose-300",
    textClass: "text-[#D93025] dark:text-rose-300",
    barClass: "bg-[#D93025]",
  },
};

export const STATUS_META: Record<
  DevelopmentStatus,
  { label: string; badgeClass: string; icon: "trending" | "sparkles" | "alert" | "flag" }
> = {
  on_track: {
    label: "On Track",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    icon: "trending",
  },
  developing: {
    label: "Developing",
    badgeClass: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    icon: "sparkles",
  },
  needs_support: {
    label: "Needs Support",
    badgeClass: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    icon: "alert",
  },
  action_required: {
    label: "Action Required",
    badgeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    icon: "flag",
  },
};

export function displayName(row: { full_name: string | null; email: string }): string {
  return (row.full_name || row.email || "Employee").trim();
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function scorePercent(score: number | null | undefined, max = 5): number {
  if (score == null || Number.isNaN(score)) return 0;
  return Math.min(100, Math.max(0, (score / max) * 100));
}
