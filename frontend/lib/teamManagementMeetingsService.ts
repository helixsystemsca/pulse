import { apiFetch } from "@/lib/api";
import type { MeetingActionItem, WorkerMeeting } from "@/lib/team-management/employee-profile/types";

export async function fetchWorkerMeetings(params?: {
  employee_user_id?: string;
  status?: string;
}): Promise<{ items: WorkerMeeting[] }> {
  const sp = new URLSearchParams();
  if (params?.employee_user_id) sp.set("employee_user_id", params.employee_user_id);
  if (params?.status) sp.set("status", params.status);
  const qs = sp.toString();
  return apiFetch(`/api/workers/meetings${qs ? `?${qs}` : ""}`);
}

export async function fetchMeetingActionItems(params?: {
  employee_user_id?: string;
  status?: string;
}): Promise<{ items: MeetingActionItem[] }> {
  const sp = new URLSearchParams();
  if (params?.employee_user_id) sp.set("employee_user_id", params.employee_user_id);
  if (params?.status) sp.set("status", params.status);
  const qs = sp.toString();
  return apiFetch(`/api/workers/meetings/action-items${qs ? `?${qs}` : ""}`);
}

export async function createWorkerMeeting(body: {
  employee_user_id: string;
  meeting_type?: string;
  scheduled_date?: string | null;
  status?: string;
  agenda?: string | null;
  wins?: string | null;
  challenges?: string | null;
  goals?: string | null;
  manager_notes?: string | null;
  employee_notes?: string | null;
  next_meeting_date?: string | null;
  recurrence?: string | null;
  action_items?: {
    title: string;
    assigned_to_user_id?: string | null;
    due_date?: string | null;
    status?: string;
    notes?: string | null;
  }[];
}): Promise<WorkerMeeting> {
  return apiFetch("/api/workers/meetings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function patchWorkerMeeting(
  meetingId: string,
  body: Record<string, unknown>,
): Promise<WorkerMeeting> {
  return apiFetch(`/api/workers/meetings/${meetingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
