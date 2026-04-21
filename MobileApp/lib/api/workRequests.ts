import { apiFetch } from "./client";

export type WorkRequestCreateIn = {
  title: string;
  description?: string | null;
  category?: string | null;
  priority?: "low" | "medium" | "high" | "critical";
  assigned_user_id?: string | null;
  due_date?: string | null;
  attachments?: unknown[] | null;
};

export type WorkRequestDetailOut = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
};

/** Creates a work request in Pulse (`/api/work-requests`). */
export async function createWorkRequest(token: string, body: WorkRequestCreateIn): Promise<WorkRequestDetailOut> {
  return apiFetch<WorkRequestDetailOut>("/api/work-requests", { method: "POST", token, body });
}

