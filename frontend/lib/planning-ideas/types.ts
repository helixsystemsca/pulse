export const PLANNING_IDEA_STATUSES = [
  "idea",
  "reviewing",
  "awaiting_approval",
  "approved",
  "deferred",
  "rejected",
  "converted",
] as const;

export type PlanningIdeaStatus = (typeof PLANNING_IDEA_STATUSES)[number];

export const PLANNING_IDEA_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export type PlanningIdeaPriority = (typeof PLANNING_IDEA_PRIORITIES)[number];

export type PlanningIdeaRow = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  location: string | null;
  category: string | null;
  estimated_cost: string | number | null;
  priority: PlanningIdeaPriority;
  status: PlanningIdeaStatus;
  created_by_user_id: string | null;
  linked_project_id: string | null;
  created_at: string;
  updated_at: string;
  converted_at: string | null;
};

export type PlanningIdeaCreateInput = {
  title: string;
  description?: string | null;
  location?: string | null;
  category?: string | null;
  estimated_cost?: number | null;
  priority?: PlanningIdeaPriority;
  status?: PlanningIdeaStatus;
};

export type PlanningIdeaPatchInput = Partial<PlanningIdeaCreateInput>;

export type PlanningIdeaConvertInput = {
  owner_user_id?: string | null;
  department_slug?: string | null;
  target_start_date: string;
  target_end_date?: string | null;
  template_id?: string | null;
  project_status?: string;
};

export type PlanningIdeaConvertResult = {
  idea: PlanningIdeaRow;
  project_id: string;
  project_name: string;
};
