import { apiFetch } from "@/lib/api";

export type SetupProgressState = {
  blueprint_count: number;
  zone_count: number;
  equipment_count: number;
  worker_user_count: number;
  procedure_task_count: number;
  gateway_count: number;
  ble_device_count: number;
  work_request_count: number;
  facility_layout_done: boolean;
  zones_done: boolean;
  equipment_done: boolean;
  workers_done: boolean;
  procedures_done: boolean;
  devices_done: boolean;
  maintenance_started_done: boolean;
};

export async function fetchSetupProgress(): Promise<SetupProgressState> {
  return apiFetch<SetupProgressState>("/api/v1/setup-progress");
}
