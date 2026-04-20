import { apiFetch } from "@/lib/api";

export type GamifiedTask = {
  id: string;
  title: string;
  description?: string | null;
  source_type: "work_order" | "pm" | "project" | "routine" | "self";
  priority: number;
  difficulty: number;
  status: "todo" | "in_progress" | "done";
  due_date?: string | null;
  created_at: string;
  completed_at?: string | null;
  xp_awarded: number;
};

export type CompleteTaskResponse = { xp: number; totalXp: number; level: number };

export type UserAnalytics = {
  totalXp: number;
  level: number;
  tasksCompleted: number;
  onTimeRate: number;
  avgCompletionTime: number;
  reviewScore: number;
  initiativeScore: number;
  xpWorker?: number;
  xpLead?: number;
  xpSupervisor?: number;
};

export async function listMyTasks(status?: "todo" | "in_progress" | "done"): Promise<GamifiedTask[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<GamifiedTask[]>(`/api/v1/tasks/my${qs}`);
}

export async function completeTask(taskId: string): Promise<CompleteTaskResponse> {
  return apiFetch<CompleteTaskResponse>(`/api/v1/tasks/${encodeURIComponent(taskId)}/complete`, { method: "POST" });
}

export async function getUserAnalytics(userId: string): Promise<UserAnalytics> {
  return apiFetch<UserAnalytics>(`/api/v1/users/${encodeURIComponent(userId)}/analytics`);
}

export function previewXp(task: Pick<GamifiedTask, "source_type" | "difficulty" | "priority">): number {
  const base =
    (
      {
        routine: 5,
        pm: 10,
        work_order: 15,
        project: 25,
        self: 3,
      } as const
    )[task.source_type] ?? 5;
  return Math.max(0, Math.floor(base * Math.max(1, task.difficulty) * Math.max(1, task.priority)));
}

