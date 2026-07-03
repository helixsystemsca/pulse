import type { ProjectRow } from "@/lib/projectsService";
import type { RoadmapCategory, RoadmapMilestone, RoadmapProjectListRow, RoadmapStats } from "@/lib/roadmap/types";

/** Map project list row → roadmap timeline row (read-only shape for UI). */
export function projectToRoadmapRow(p: ProjectRow, ownerLabel?: string | null): RoadmapProjectListRow {
  const archived = Boolean(p.archived_at) || p.status === "archived";
  return {
    id: p.id,
    title: p.name,
    category: projectCategoryKey(p),
    owner: ownerLabel ?? null,
    color: p.overlay_color ?? p.category?.color ?? null,
    start_date: p.start_date,
    end_date: p.end_date,
    progress: p.progress_pct ?? 0,
    priority: mapStaffingToPriority(p.staffing_priority),
    status: mapProjectStatus(p.status),
    sort_order: 0,
    archived,
    dependencies: [],
    isPlaceholder: Boolean(p.roadmap_stub),
    pulseProject: p,
  };
}

export type RoadmapProjectListRowWithSource = RoadmapProjectListRow & {
  pulseProject: ProjectRow;
};

function mapStaffingToPriority(
  staffing?: ProjectRow["staffing_priority"],
): RoadmapProjectListRow["priority"] {
  if (staffing === "critical") return "critical";
  if (staffing === "high") return "high";
  if (staffing === "low") return "low";
  return "medium";
}

function mapProjectStatus(status: string): RoadmapProjectListRow["status"] {
  if (status === "completed") return "completed";
  if (status === "on_hold") return "on_hold";
  if (status === "archived") return "archived";
  if (status === "active") return "in_progress";
  if (status === "future") return "planned";
  return "planned";
}

function projectCategoryKey(p: ProjectRow): RoadmapCategory {
  const name = (p.category?.name ?? "").trim().toLowerCase();
  const keys: Record<string, RoadmapCategory> = {
    facilities: "facilities",
    facility: "facilities",
    "asset management": "asset_management",
    assets: "asset_management",
    projects: "projects",
    project: "projects",
    safety: "safety",
    training: "training",
    operations: "operations",
    administration: "administration",
    admin: "administration",
  };
  for (const [needle, key] of Object.entries(keys)) {
    if (name.includes(needle)) return key;
  }
  return "projects";
}

/** True when project dates overlap [rangeStart, rangeEnd] (inclusive). */
export function projectOverlapsRange(
  startIso: string,
  endIso: string,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  return startIso <= rangeEnd && endIso >= rangeStart;
}

export function projectsInRange(rows: ProjectRow[], rangeStart: string, rangeEnd: string): ProjectRow[] {
  return rows.filter((p) => projectOverlapsRange(p.start_date, p.end_date, rangeStart, rangeEnd));
}

export function computeRoadmapStats(rows: RoadmapProjectListRow[], today = new Date()): RoadmapStats {
  const active = rows.filter((p) => !p.archived);
  const todayIso = today.toISOString().slice(0, 10);
  return {
    total: active.length,
    completed: active.filter((p) => p.status === "completed").length,
    in_progress: active.filter((p) => p.status === "in_progress").length,
    behind: active.filter(
      (p) => p.status !== "completed" && p.end_date < todayIso && p.progress < 100,
    ).length,
    upcoming_milestones: 0,
  };
}

export type TaskMilestoneSource = {
  id: string;
  project_id: string;
  title: string;
  milestone_date: string;
  completed: boolean;
};

export function taskMilestonesToRoadmap(rows: TaskMilestoneSource[]): RoadmapMilestone[] {
  return rows.map((r) => ({
    id: r.id,
    company_id: "",
    roadmap_project_id: r.project_id,
    title: r.title,
    milestone_date: r.milestone_date,
    completed: r.completed,
    sort_order: 0,
    created_at: "",
    updated_at: "",
  }));
}
