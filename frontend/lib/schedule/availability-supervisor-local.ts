/**
 * Client-side demo persistence for supervisor availability tracking.
 * Replace with API-backed requests when staffing intelligence ships.
 */

import type { Worker } from "@/lib/schedule/types";

export type AuxSubmissionStatus = "submitted" | "pending" | "overdue";

export type AuxSubmissionRecord = {
  status: AuxSubmissionStatus;
  submittedAt?: string;
  remindersSent: number;
};

const KEY = "pulse_schedule_aux_availability_v1";

export function auxiliaryWorkers(workers: Worker[]): Worker[] {
  return workers.filter(
    (w) => w.active && (w.employmentType === "part_time" || w.employmentType === "regular_part_time"),
  );
}

export function loadSubmissionMap(): Record<string, AuxSubmissionRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, AuxSubmissionRecord>;
  } catch {
    return {};
  }
}

export function saveSubmissionMap(map: Record<string, AuxSubmissionRecord>) {
  sessionStorage.setItem(KEY, JSON.stringify(map));
}

export function countPendingSubmissions(map: Record<string, AuxSubmissionRecord>, auxIds: string[]): number {
  let n = 0;
  for (const id of auxIds) {
    const s = map[id]?.status ?? "pending";
    if (s !== "submitted") n++;
  }
  return n;
}

export function ensureAuxiliaryRows(
  workers: Worker[],
  existing: Record<string, AuxSubmissionRecord>,
): Record<string, AuxSubmissionRecord> {
  const next = { ...existing };
  let changed = false;
  for (const w of auxiliaryWorkers(workers)) {
    if (!next[w.id]) {
      next[w.id] = { status: "pending", remindersSent: 0 };
      changed = true;
    }
  }
  if (changed) saveSubmissionMap(next);
  return next;
}
