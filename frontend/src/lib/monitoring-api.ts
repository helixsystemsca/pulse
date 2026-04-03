/**
 * Monitoring API (/api/v1/monitoring). Wire sensors via env:
 * NEXT_PUBLIC_MONITORING_SENSORS={"ph":"<uuid>","chlorine":"<uuid>","temp":"<uuid>","flow":"<uuid>"}
 */

import { apiFetch } from "@/lib/api";

const API_PREFIX = "/api/v1/monitoring";

export type MetricKey = "ph" | "chlorine" | "temp" | "flow";

export type Freshness = "live" | "delayed" | "stale";

export type SensorReadingOut = {
  id: string;
  sensor_id: string;
  observed_at: string;
  value_num: string | null;
  value_bool: boolean | null;
  value_text: string | null;
  received_at: string;
};

export type SensorOut = {
  id: string;
  monitored_system_id: string;
  zone_id: string | null;
  name: string;
  external_key: string | null;
  unit: string | null;
  expected_interval_seconds: number;
};

export type SensorDetailOut = {
  sensor: SensorOut;
  latest_reading: SensorReadingOut | null;
  freshness: Freshness;
};

export function parseReadingNum(r: SensorReadingOut | null | undefined): number | null {
  if (!r?.value_num) return null;
  const n = Number(r.value_num);
  return Number.isFinite(n) ? n : null;
}

/** Map metric keys to backend sensor UUIDs; null if unset or invalid. */
export function loadSensorIdMap(): Partial<Record<MetricKey, string>> | null {
  const raw = process.env.NEXT_PUBLIC_MONITORING_SENSORS;
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<MetricKey, string>> = {};
    for (const k of ["ph", "chlorine", "temp", "flow"] as const) {
      const v = o[k];
      if (typeof v === "string" && v.length >= 8) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export async function getSensorDetail(sensorId: string): Promise<SensorDetailOut> {
  return apiFetch<SensorDetailOut>(`${API_PREFIX}/sensors/${sensorId}`);
}

export async function getSensorReadings(
  sensorId: string,
  from: Date,
  to: Date,
  limit = 2000,
): Promise<SensorReadingOut[]> {
  const q = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    limit: String(limit),
  });
  return apiFetch<SensorReadingOut[]>(`${API_PREFIX}/sensors/${sensorId}/readings?${q}`);
}
