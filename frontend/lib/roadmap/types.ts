export type RoadmapCategory =
  | "facilities"
  | "asset_management"
  | "projects"
  | "safety"
  | "training"
  | "operations"
  | "administration";

export type RoadmapPriority = "low" | "medium" | "high" | "critical";

export type RoadmapStatus = "planned" | "in_progress" | "completed" | "on_hold" | "cancelled" | "archived";

export type RoadmapZoom = "year" | "half_year" | "quarter" | "month";

export type RoadmapMilestone = {
  id: string;
  company_id: string;
  roadmap_project_id: string | null;
  title: string;
  milestone_date: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type RoadmapProject = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  category: RoadmapCategory;
  owner: string | null;
  owner_user_id: string | null;
  color: string | null;
  start_date: string;
  end_date: string;
  progress: number;
  priority: RoadmapPriority;
  status: RoadmapStatus;
  budget: number | null;
  tags: string[];
  dependencies: string[];
  notes: string | null;
  attachments: { name: string; url: string }[];
  sort_order: number;
  archived: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  milestones?: RoadmapMilestone[];
};

export type RoadmapProjectListRow = {
  id: string;
  title: string;
  category: RoadmapCategory;
  owner: string | null;
  color: string | null;
  start_date: string;
  end_date: string;
  progress: number;
  priority: RoadmapPriority;
  status: RoadmapStatus;
  sort_order: number;
  archived: boolean;
  dependencies: string[];
  /** Roadmap-only placeholder — not yet set up with tasks on Projects. */
  isPlaceholder?: boolean;
  /** Original project row when sourced from `/api/v1/projects`. */
  pulseProject?: import("@/lib/projectsService").ProjectRow;
};

export type RoadmapStats = {
  total: number;
  completed: number;
  in_progress: number;
  behind: number;
  upcoming_milestones: number;
};

export type RoadmapFilters = {
  search: string;
  categories: RoadmapCategory[];
  owners: string[];
  statuses: RoadmapStatus[];
  priorities: RoadmapPriority[];
  tags: string[];
  showArchived: boolean;
  showDependencies: boolean;
};
