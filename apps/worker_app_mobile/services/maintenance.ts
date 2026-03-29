import { api } from "@/services/api";

export type MaintenanceSchedule = {
  id: string;
  name: string;
  tool_id: string | null;
  interval_days: number | null;
  usage_units_threshold: number | null;
  next_due_at: string | null;
};

export async function fetchSchedules(): Promise<MaintenanceSchedule[]> {
  const { data } = await api.get<MaintenanceSchedule[]>("/api/v1/maintenance/schedules");
  return data;
}

export async function confirmSchedule(
  scheduleId: string,
  body: { notes?: string; inference_triggered?: boolean } = {},
): Promise<{ log_id: string }> {
  const { data } = await api.post<{ log_id: string }>(
    `/api/v1/maintenance/schedules/${scheduleId}/confirm`,
    {
      notes: body.notes ?? null,
      inference_triggered: body.inference_triggered ?? false,
    },
  );
  return data;
}
