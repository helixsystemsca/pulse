/** Cached Pulse reference lists shared by dashboard widgets and inventory. */
import { apiFetch } from "@/lib/api";
import { fetchReferenceCached, setReferenceCache } from "@/lib/api-reference-cache";
import type { PulseShiftApi, PulseWorkerApi, PulseZoneApi } from "@/lib/schedule/pulse-bridge";

export type PulseZoneOpt = { id: string; name: string; meta?: Record<string, unknown> };
export type PulseAssetOpt = {
  id: string;
  tag_id: string | null;
  name: string;
  zone_id: string | null;
  status: string;
  assigned_user_id: string | null;
};
export type PulseWorkerOpt = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
};

export function fetchPulseWorkersCached(): Promise<PulseWorkerApi[]> {
  return fetchReferenceCached("pulse:workers", () => apiFetch<PulseWorkerApi[]>("/api/v1/pulse/workers"));
}

export function fetchPulseScheduleFacilitiesCached(): Promise<PulseZoneApi[]> {
  return fetchReferenceCached("pulse:schedule-facilities", () =>
    apiFetch<PulseZoneApi[]>("/api/v1/pulse/schedule-facilities"),
  );
}

export function fetchPulseZonesCached(inventoryOnly = false): Promise<PulseZoneOpt[]> {
  const suffix = inventoryOnly ? "?inventory_only=true" : "";
  const key = inventoryOnly ? "pulse:zones:inventory" : "pulse:zones";
  return fetchReferenceCached(key, () => apiFetch<PulseZoneOpt[]>(`/api/v1/pulse/zones${suffix}`));
}

/** Zones safe for inventory storage (excludes schedule facilities server-side when possible). */
export function fetchInventoryStorageZonesCached(): Promise<PulseZoneOpt[]> {
  return fetchPulseZonesCached(true);
}

export function fetchPulseAssetsCached(): Promise<PulseAssetOpt[]> {
  return fetchReferenceCached("pulse:assets", () => apiFetch<PulseAssetOpt[]>("/api/v1/pulse/assets"));
}

export function fetchPulseWorkersOptsCached(): Promise<PulseWorkerOpt[]> {
  return fetchReferenceCached("pulse:workers-opts", () => apiFetch<PulseWorkerOpt[]>("/api/v1/pulse/workers"));
}

export function primePulseReferenceFromBootstrap(payload: {
  workers?: PulseWorkerApi[];
  schedule_facilities?: PulseZoneApi[];
  assets?: Array<{ id: string; name: string; tag_id?: string | null }>;
}): void {
  if (payload.workers?.length) {
    setReferenceCache("pulse:workers", payload.workers);
    setReferenceCache("pulse:workers-opts", payload.workers);
  }
  if (payload.schedule_facilities?.length) {
    setReferenceCache("pulse:schedule-facilities", payload.schedule_facilities);
  }
  if (payload.assets?.length) {
    setReferenceCache("pulse:assets", payload.assets);
  }
}

export function fetchPulseShiftsCached(fromIso: string, toIso: string): Promise<PulseShiftApi[]> {
  const key = `pulse:shifts:${fromIso}:${toIso}`;
  return fetchReferenceCached(
    key,
    () =>
      apiFetch<PulseShiftApi[]>(
        `/api/v1/pulse/schedule/shifts?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      ),
    60_000,
  );
}
