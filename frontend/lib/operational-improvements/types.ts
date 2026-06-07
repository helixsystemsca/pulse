export type OperationalImprovementStatus =
  | "identified"
  | "analyzing"
  | "planning"
  | "implementing"
  | "measuring"
  | "completed"
  | "awaiting_review"
  | "archived";

export type OperationalImprovementPriority = "low" | "medium" | "high" | "critical";

export type OperationalImprovementCategory =
  | "inventory"
  | "procurement"
  | "communication"
  | "scheduling"
  | "maintenance"
  | "safety"
  | "quality"
  | "documentation"
  | "other";

export type OperationalImprovementAnalysisType =
  | "root_cause_5_whys"
  | "fishbone"
  | "process_analysis"
  | "five_s"
  | "kanban"
  | "kaizen"
  | "standardization";

export type OperationalImprovementActionStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "blocked"
  | "cancelled";

export type AttachmentType = "photo" | "diagram" | "document" | "process_map" | "other";

export const OI_STATUSES: OperationalImprovementStatus[] = [
  "identified",
  "analyzing",
  "planning",
  "implementing",
  "measuring",
  "completed",
  "awaiting_review",
  "archived",
];

export const OI_CATEGORIES: OperationalImprovementCategory[] = [
  "inventory",
  "procurement",
  "communication",
  "scheduling",
  "maintenance",
  "safety",
  "quality",
  "documentation",
  "other",
];

export const OI_ANALYSIS_TYPES: OperationalImprovementAnalysisType[] = [
  "root_cause_5_whys",
  "fishbone",
  "process_analysis",
  "five_s",
  "kanban",
  "kaizen",
  "standardization",
];

export type ImplementationData = {
  start_date?: string | null;
  completion_date?: string | null;
  resources_required?: string | null;
  budget?: string | null;
  risks?: string | null;
  dependencies?: string | null;
};

export type MeasurementData = {
  success_criteria?: string | null;
  baseline_metrics?: string | null;
  target_metrics?: string | null;
  actual_results?: string | null;
  lessons_learned?: string | null;
  follow_up_review_date?: string | null;
};

export type OperationalImprovementAnalysisRow = {
  id: string;
  company_id: string;
  improvement_id: string;
  analysis_type: OperationalImprovementAnalysisType;
  title?: string | null;
  data: Record<string, unknown>;
  created_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type OperationalImprovementActionRow = {
  id: string;
  company_id: string;
  improvement_id: string;
  action: string;
  owner_user_id?: string | null;
  due_date?: string | null;
  status: OperationalImprovementActionStatus;
  notes?: string | null;
  linked_work_request_id?: string | null;
  linked_project_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type OperationalImprovementAttachmentRow = {
  id: string;
  company_id: string;
  improvement_id: string;
  file_name: string;
  file_url?: string | null;
  attachment_type: AttachmentType;
  caption?: string | null;
  uploaded_by_user_id?: string | null;
  created_at: string;
};

export type OperationalImprovementRow = {
  id: string;
  company_id: string;
  display_id?: string | null;
  display_number?: number | null;
  title: string;
  description?: string | null;
  department_slug?: string | null;
  location?: string | null;
  zone_id?: string | null;
  reporter_user_id?: string | null;
  date_identified?: string | null;
  priority: OperationalImprovementPriority;
  category: OperationalImprovementCategory;
  estimated_impact?: string | null;
  current_symptoms?: string | null;
  stakeholders_affected?: string | null;
  status: OperationalImprovementStatus;
  implementation_data: ImplementationData;
  measurement_data: MeasurementData;
  knowledge_base_published: boolean;
  created_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
  analyses: OperationalImprovementAnalysisRow[];
  actions: OperationalImprovementActionRow[];
  attachments: OperationalImprovementAttachmentRow[];
};

export type OperationalImprovementListRow = {
  id: string;
  company_id: string;
  display_id?: string | null;
  title: string;
  description?: string | null;
  department_slug?: string | null;
  location?: string | null;
  priority: OperationalImprovementPriority;
  category: OperationalImprovementCategory;
  estimated_impact?: string | null;
  status: OperationalImprovementStatus;
  date_identified?: string | null;
  knowledge_base_published: boolean;
  created_at: string;
  updated_at: string;
  action_count: number;
  analysis_count: number;
};

export type OperationalImprovementStats = {
  open_count: number;
  completed_count: number;
  awaiting_review_count: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  high_impact_open: number;
};

export type OperationalImprovementCaseStudy = {
  id: string;
  display_id?: string | null;
  title: string;
  category: OperationalImprovementCategory;
  department_slug?: string | null;
  location?: string | null;
  problem?: string | null;
  root_cause?: string | null;
  solution?: string | null;
  results?: string | null;
  lessons_learned?: string | null;
  completed_at?: string | null;
  published_at: string;
};

export type OperationalImprovementCreateInput = {
  title: string;
  description?: string;
  department_slug?: string;
  location?: string;
  zone_id?: string;
  reporter_user_id?: string;
  date_identified?: string;
  priority?: OperationalImprovementPriority;
  category?: OperationalImprovementCategory;
  estimated_impact?: string;
  current_symptoms?: string;
  stakeholders_affected?: string;
  status?: OperationalImprovementStatus;
};

export type OperationalImprovementPatchInput = Partial<
  Omit<OperationalImprovementCreateInput, "title"> & {
    title?: string;
    implementation_data?: ImplementationData;
    measurement_data?: MeasurementData;
    knowledge_base_published?: boolean;
  }
>;
