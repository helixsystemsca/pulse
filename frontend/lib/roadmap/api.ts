/**
 * Roadmap reads strategic timeline data from Projects (`/api/v1/projects`).
 * Task due dates supply milestone markers; optional `/roadmap/task-milestones` aggregates them.
 */
import { apiFetch } from "@/lib/api";
import {
  createProject,
  createRoadmapStubs,
  deleteProject,
  getProject,
  listProjects,
  patchProject,
  type ProjectRow,
} from "@/lib/projectsService";
import {
  computeRoadmapStats,
  projectToRoadmapRow,
  taskMilestonesToRoadmap,
  type TaskMilestoneSource,
} from "@/lib/roadmap/project-adapter";
import type { RoadmapMilestone, RoadmapProjectListRow, RoadmapStats } from "@/lib/roadmap/types";

export async function fetchRoadmapProjectsFromPulse(
  ownerByUserId?: Map<string, string>,
): Promise<RoadmapProjectListRow[]> {
  const rows = await listProjects();
  return rows.map((p) =>
    projectToRoadmapRow(p, p.owner_user_id ? ownerByUserId?.get(p.owner_user_id) ?? null : null),
  );
}

export async function fetchRoadmapTaskMilestones(year: number): Promise<RoadmapMilestone[]> {
  const rows = await apiFetch<TaskMilestoneSource[]>(`/api/v1/roadmap/task-milestones?year=${year}`);
  return taskMilestonesToRoadmap(rows);
}

export function computeStatsFromProjects(rows: RoadmapProjectListRow[]): RoadmapStats {
  return computeRoadmapStats(rows);
}

export async function patchRoadmapProjectDates(id: string, start_date: string, end_date: string): Promise<ProjectRow> {
  return patchProject(id, { start_date, end_date });
}

export { createRoadmapStubs, deleteProject, getProject, patchProject, listProjects };
export type { ProjectRow, RoadmapStubItem } from "@/lib/projectsService";
