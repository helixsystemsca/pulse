/** Phase 1 Command Center API — `/api/v1/recreation-ops/command`. */
import { apiFetch, apiFetchBlob } from "@/lib/api";

const BASE = "/api/v1/recreation-ops/command";

export type OpsPersonalProfile = {
  id: string;
  company_id: string;
  user_id: string;
  display_name: string | null;
  position: string | null;
  department: string | null;
  manager_name: string | null;
  start_date: string | null;
  contact_info: string | null;
  certifications: unknown[];
  qualifications: unknown[];
  philosophy: Record<string, string>;
  principles: string[];
  role_purpose: string | null;
  linked_ops_person_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OpsRoleResponsibility = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  priority: string;
  frequency: string | null;
  notes: string | null;
  sort_order: number;
};

export type OpsAuthorityRow = {
  id: string;
  decision: string;
  levels: Record<string, boolean | string>;
  status: string;
  notes: string | null;
  sort_order: number;
};

export type OpsChecklistItem = {
  id: string;
  instance_id: string;
  section: string;
  title: string;
  description: string | null;
  completed: boolean;
  completed_at: string | null;
  due_date: string | null;
  priority: string;
  notes: string | null;
  sort_order: number;
};

export type OpsChecklistInstance = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  due_date: string | null;
  notes: string | null;
  template_id: string | null;
  progress_pct: number;
  items: OpsChecklistItem[];
  incomplete_items?: Array<{ id: string; title: string; section: string }>;
  facility_id?: string | null;
  season_year?: number | null;
  created_at: string;
  updated_at: string;
};

export type OpsChecklistTemplate = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string;
  structure: unknown[];
  is_system: boolean;
};

export type OpsKnowledgeGap = {
  id: string;
  question: string;
  category: string;
  priority: string;
  who_should_answer: string | null;
  status: string;
  answer: string | null;
  source: string | null;
  date_confirmed: string | null;
  related_policy: string | null;
  related_person: string | null;
  related_procedure: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OpsCommandDashboard = {
  checklist_due_today: number;
  checklist_overdue: number;
  checklist_open_items: number;
  active_checklists: number;
  knowledge_gaps_open: number;
  knowledge_gaps_high: number;
  authority_unknown: number;
  profile_complete: boolean;
  open_team_risks: number;
  people_count: number;
  assets_needing_attention: number;
  inventory_low_stock: number;
  training_overdue: number;
  compliance_missed: number;
  critical_procedures: number;
  emergency_readiness_gaps: number;
  active_projects: number;
  overdue_project_tasks: number;
  roadmap_behind: number;
  pm_coord_risks: number;
  overdue_work_requests: number;
  roadmap_with_budget: number;
  certs_expired?: number;
  certs_expiring_30?: number;
  certs_expiring_90?: number;
  contractor_attention?: number;
  intelligence_items: Array<Record<string, unknown>>;
  due_items: Array<Record<string, unknown>>;
  open_gaps: Array<{
    id: string;
    question: string;
    category: string;
    priority: string;
    status: string;
  }>;
  active_checklist_summaries: Array<{
    id: string;
    title: string;
    progress_pct: number;
    item_count: number;
    completed: number;
    due_date: string | null;
  }>;
};

export type OpsIntelligence = {
  assets: Record<string, unknown>;
  inventory: Record<string, unknown>;
  procedures: Record<string, unknown>;
  training: Record<string, unknown>;
  compliance: Record<string, unknown>;
  emergency: Record<string, unknown>;
  projects: Record<string, unknown>;
  planning_risks: Record<string, unknown>;
  budget: Record<string, unknown>;
  maintenance: Record<string, unknown>;
  certifications?: Record<string, unknown>;
  contractors?: Record<string, unknown>;
  attention_items: Array<{
    kind: string;
    title: string;
    priority: string;
    href: string;
    detail?: string | null;
  }>;
  totals: Record<string, number>;
};

export async function fetchCommandDashboard(): Promise<OpsCommandDashboard> {
  return apiFetch<OpsCommandDashboard>(`${BASE}/dashboard`);
}

export async function fetchIntelligence(): Promise<OpsIntelligence> {
  return apiFetch<OpsIntelligence>(`${BASE}/intelligence`);
}

export const BINDER_SECTION_LABELS: Record<string, string> = {
  profile: "My Profile",
  role: "Role & Responsibilities",
  org: "Organization",
  people: "People",
  checklists: "Checklists",
  knowledge_gaps: "Knowledge Gaps",
  team_development: "Team Development",
  emergency: "Emergency Readiness",
  attention: "Operational Attention",
};

export type OpsReportsCatalog = {
  binder_sections: string[];
  standalone_types: string[];
};

export async function fetchReportsCatalog(): Promise<OpsReportsCatalog> {
  return apiFetch<OpsReportsCatalog>(`${BASE}/reports/catalog`);
}

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadBinderPdf(sections?: string[]): Promise<void> {
  const blob = await apiFetchBlob(`${BASE}/reports/binder.pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sections: sections ?? [] }),
  });
  await downloadBlob(blob, "recreation-ops-binder.pdf");
}

export async function downloadStandalonePdf(
  reportType: string,
  entityId?: string,
): Promise<void> {
  const qs = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : "";
  const blob = await apiFetchBlob(`${BASE}/reports/${reportType}.pdf${qs}`);
  await downloadBlob(blob, `recreation-ops-${reportType}.pdf`);
}

export async function fetchProfile(): Promise<OpsPersonalProfile> {
  return apiFetch<OpsPersonalProfile>(`${BASE}/profile`);
}

export async function patchProfile(body: Partial<OpsPersonalProfile>): Promise<OpsPersonalProfile> {
  return apiFetch<OpsPersonalProfile>(`${BASE}/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listResponsibilities(): Promise<OpsRoleResponsibility[]> {
  return apiFetch<OpsRoleResponsibility[]>(`${BASE}/responsibilities`);
}

export async function createResponsibility(
  body: Partial<OpsRoleResponsibility> & { title: string },
): Promise<OpsRoleResponsibility> {
  return apiFetch<OpsRoleResponsibility>(`${BASE}/responsibilities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function patchResponsibility(
  id: string,
  body: Partial<OpsRoleResponsibility>,
): Promise<OpsRoleResponsibility> {
  return apiFetch<OpsRoleResponsibility>(`${BASE}/responsibilities/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteResponsibility(id: string): Promise<void> {
  await apiFetch(`${BASE}/responsibilities/${id}`, { method: "DELETE" });
}

export async function listAuthority(): Promise<OpsAuthorityRow[]> {
  return apiFetch<OpsAuthorityRow[]>(`${BASE}/authority`);
}

export async function createAuthority(
  body: Partial<OpsAuthorityRow> & { decision: string },
): Promise<OpsAuthorityRow> {
  return apiFetch<OpsAuthorityRow>(`${BASE}/authority`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function patchAuthority(id: string, body: Partial<OpsAuthorityRow>): Promise<OpsAuthorityRow> {
  return apiFetch<OpsAuthorityRow>(`${BASE}/authority/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteAuthority(id: string): Promise<void> {
  await apiFetch(`${BASE}/authority/${id}`, { method: "DELETE" });
}

export async function listChecklistTemplates(): Promise<OpsChecklistTemplate[]> {
  return apiFetch<OpsChecklistTemplate[]>(`${BASE}/checklist-templates`);
}

export async function listChecklists(): Promise<OpsChecklistInstance[]> {
  return apiFetch<OpsChecklistInstance[]>(`${BASE}/checklists`);
}

export async function getChecklist(id: string): Promise<OpsChecklistInstance> {
  return apiFetch<OpsChecklistInstance>(`${BASE}/checklists/${id}`);
}

export async function startChecklist(body: {
  template_slug?: string;
  template_id?: string;
  title?: string;
  due_date?: string;
  priority?: string;
  facility_id?: string | null;
  season_year?: number | null;
}): Promise<OpsChecklistInstance> {
  return apiFetch<OpsChecklistInstance>(`${BASE}/checklists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function patchChecklistItem(
  id: string,
  body: Partial<OpsChecklistItem>,
): Promise<OpsChecklistItem> {
  return apiFetch<OpsChecklistItem>(`${BASE}/checklist-items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteChecklist(id: string): Promise<void> {
  await apiFetch(`${BASE}/checklists/${id}`, { method: "DELETE" });
}

export async function listKnowledgeGaps(params?: {
  status?: string;
  q?: string;
}): Promise<OpsKnowledgeGap[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.q) qs.set("q", params.q);
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<OpsKnowledgeGap[]>(`${BASE}/knowledge-gaps${suffix}`);
}

export async function createKnowledgeGap(
  body: Partial<OpsKnowledgeGap> & { question: string },
): Promise<OpsKnowledgeGap> {
  return apiFetch<OpsKnowledgeGap>(`${BASE}/knowledge-gaps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function patchKnowledgeGap(
  id: string,
  body: Partial<OpsKnowledgeGap>,
): Promise<OpsKnowledgeGap> {
  return apiFetch<OpsKnowledgeGap>(`${BASE}/knowledge-gaps/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteKnowledgeGap(id: string): Promise<void> {
  await apiFetch(`${BASE}/knowledge-gaps/${id}`, { method: "DELETE" });
}

export type OpsOrgNode = {
  id: string;
  title: string;
  position: string | null;
  department: string | null;
  team_name: string | null;
  role_label: string | null;
  reports_to_person_id: string | null;
  status: string;
  children: OpsOrgNode[];
};

export type OpsSkill = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  sort_order: number;
};

export type OpsSkillRating = {
  id: string;
  skill_id: string;
  person_id: string;
  proficiency: string;
  certification: string | null;
  last_demonstrated: string | null;
  training_required: boolean;
  cross_training_status: string | null;
  notes: string | null;
  skill_name?: string | null;
  person_name?: string | null;
};

export type OpsDevelopmentPlan = {
  id: string;
  person_id: string;
  title: string;
  strengths: string | null;
  development_goals: string | null;
  training: string | null;
  mentoring: string | null;
  cross_training: string | null;
  target_date: string | null;
  progress: string;
  status: string;
  notes: string | null;
  person_name?: string | null;
};

export type OpsTeamRisk = {
  id: string;
  title: string;
  risk_type: string;
  description: string | null;
  severity: string;
  related_person_id: string | null;
  related_skill: string | null;
  status: string;
  mitigation: string | null;
  notes: string | null;
  person_name?: string | null;
};

export async function fetchOrgChart(): Promise<OpsOrgNode[]> {
  return apiFetch<OpsOrgNode[]>(`${BASE}/org-chart`);
}

export async function listSkills(): Promise<OpsSkill[]> {
  return apiFetch<OpsSkill[]>(`${BASE}/skills`);
}

export async function createSkill(body: Partial<OpsSkill> & { name: string }): Promise<OpsSkill> {
  return apiFetch<OpsSkill>(`${BASE}/skills`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteSkill(id: string): Promise<void> {
  await apiFetch(`${BASE}/skills/${id}`, { method: "DELETE" });
}

export async function listSkillRatings(): Promise<OpsSkillRating[]> {
  return apiFetch<OpsSkillRating[]>(`${BASE}/skill-ratings`);
}

export async function upsertSkillRating(
  body: Partial<OpsSkillRating> & { skill_id: string; person_id: string },
): Promise<OpsSkillRating> {
  return apiFetch<OpsSkillRating>(`${BASE}/skill-ratings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listDevelopmentPlans(): Promise<OpsDevelopmentPlan[]> {
  return apiFetch<OpsDevelopmentPlan[]>(`${BASE}/development-plans`);
}

export async function createDevelopmentPlan(
  body: Partial<OpsDevelopmentPlan> & { person_id: string },
): Promise<OpsDevelopmentPlan> {
  return apiFetch<OpsDevelopmentPlan>(`${BASE}/development-plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function patchDevelopmentPlan(
  id: string,
  body: Partial<OpsDevelopmentPlan>,
): Promise<OpsDevelopmentPlan> {
  return apiFetch<OpsDevelopmentPlan>(`${BASE}/development-plans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteDevelopmentPlan(id: string): Promise<void> {
  await apiFetch(`${BASE}/development-plans/${id}`, { method: "DELETE" });
}

export async function listTeamRisks(): Promise<OpsTeamRisk[]> {
  return apiFetch<OpsTeamRisk[]>(`${BASE}/team-risks`);
}

export async function createTeamRisk(body: Partial<OpsTeamRisk> & { title: string }): Promise<OpsTeamRisk> {
  return apiFetch<OpsTeamRisk>(`${BASE}/team-risks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function patchTeamRisk(id: string, body: Partial<OpsTeamRisk>): Promise<OpsTeamRisk> {
  return apiFetch<OpsTeamRisk>(`${BASE}/team-risks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteTeamRisk(id: string): Promise<void> {
  await apiFetch(`${BASE}/team-risks/${id}`, { method: "DELETE" });
}

export const PHILOSOPHY_LABELS: Record<string, string> = {
  leadership: "Leadership",
  safety: "Safety",
  maintenance: "Maintenance",
  asset_management: "Asset management",
  customer_service: "Customer service",
  continuous_improvement: "Continuous improvement",
  decision_making: "Decision making",
};

export const AUTHORITY_LEVELS = ["staff", "coordinator", "manager", "director"] as const;

export const PROFICIENCY_LEVELS = ["beginner", "developing", "competent", "advanced", "expert"] as const;

export const TEAM_RISK_TYPES = [
  "single_point_of_failure",
  "skill_shortage",
  "certification_gap",
  "succession_gap",
  "institutional_knowledge",
] as const;
