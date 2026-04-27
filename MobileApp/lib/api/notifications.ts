import { apiFetch } from "./client";

export type AppNotification = {
  id: string;
  event_type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, unknown>;
};

export async function listNotifications(token: string): Promise<AppNotification[]> {
  return apiFetch<AppNotification[]>("/api/v1/notifications", { token });
}

export async function markNotificationRead(token: string, id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
    token,
  });
}

