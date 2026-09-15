/** Persist inspection runs and create corrective work requests. */
import { apiFetch } from "@/lib/api";

export type InspectionItem = {
  id: string;
  run_id: string;
  title: string;
  result: string | null;
  notes: string | null;
  evidence: unknown[];
  work_request_id: string | null;
  failed: boolean;
  sort_order: number;
};

export type InspectionRun = {
  id: string;
  company_id: string;
  title: string;
  template_key: string | null;
  template_type: string | null;
  status: string;
  overall_result: string | null;
  facility_id: string | null;
  equipment_id: string | null;
  zone_id: string | null;
  notes: string | null;
  evidence: unknown[];
  values: Record<string, unknown>;
  items: InspectionItem[];
  failed_count: number;
  open_corrective_count: number;
  created_at: string;
};

export async function listInspectionRuns(): Promise<InspectionRun[]> {
  const res = await apiFetch<{ items: InspectionRun[] }>("/api/inspections/runs");
  return res.items;
}

export async function getInspectionRun(id: string): Promise<InspectionRun> {
  return apiFetch<InspectionRun>(`/api/inspections/runs/${encodeURIComponent(id)}`);
}

export async function createInspectionRun(body: {
  title: string;
  template_key?: string;
  template_type?: string;
  overall_result?: string;
  facility_id?: string | null;
  equipment_id?: string | null;
  zone_id?: string | null;
  notes?: string;
  evidence?: unknown[];
  values?: Record<string, unknown>;
  items?: Array<{
    title: string;
    result?: string | null;
    notes?: string | null;
    evidence?: unknown[];
    sort_order?: number;
  }>;
}): Promise<InspectionRun> {
  return apiFetch<InspectionRun>("/api/inspections/runs", {
    method: "POST",
    json: body,
  });
}

export async function createCorrectiveAction(
  runId: string,
  itemId: string,
): Promise<{ inspection: InspectionRun; work_request_id: string; work_order_number: number; href: string }> {
  return apiFetch(`/api/inspections/runs/${encodeURIComponent(runId)}/items/${encodeURIComponent(itemId)}/corrective-action`, {
    method: "POST",
  });
}

export function isFailResult(result: unknown): boolean {
  const v = String(result ?? "").trim().toLowerCase();
  return v === "fail" || v === "failed" || v === "unacceptable" || v === "no";
}

export function resultFromInspectionValue(
  responseType: string | undefined,
  value: unknown,
): { result: string | null; notes: string | null } {
  const rt = responseType ?? "checkbox";
  if (rt === "checkbox") {
    return { result: value === true ? "pass" : "fail", notes: null };
  }
  if (rt === "yes_no") {
    const v = String(value ?? "").toLowerCase();
    if (v === "yes") return { result: "pass", notes: null };
    if (v === "no") return { result: "fail", notes: null };
    return { result: null, notes: null };
  }
  const notes = value == null || value === "" ? null : String(value);
  return { result: null, notes };
}
