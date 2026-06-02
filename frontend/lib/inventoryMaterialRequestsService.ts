import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";

function withCompany(path: string, companyId: string | null): string {
  if (!companyId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}company_id=${encodeURIComponent(companyId)}`;
}

export type MaterialRequestQueueRow = {
  id: string;
  inventory_item_id: string;
  item_name: string;
  sku: string;
  category: string | null;
  vendor: string | null;
  vendor_part_number: string | null;
  unit: string | null;
  reimbursable: boolean | null;
  current_qty: number;
  minimum_qty: number;
  maximum_qty: number | null;
  reorder_qty: number;
  estimated_unit_cost: number | null;
  status: string;
  exported_at: string | null;
  export_batch_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MaterialRequestExportRecord = {
  id: string;
  project: string;
  location: string;
  cost_object: string | null;
  item_count: number;
  file_name: string;
  created_by_user_id: string | null;
  created_at: string;
};

export type MaterialRequestQueueExportBody = {
  queue_item_ids: string[];
  project: string;
  location: string;
  cost_object?: string;
  comments?: string;
  notify_emails?: string[];
};

export type MaterialRequestDraftItemRow = {
  id: string;
  queue_item_id: string | null;
  item_name: string;
  sku: string;
  vendor: string | null;
  qty_requested: number;
  estimated_unit_cost: number | null;
  estimated_cost: number | null;
};

export type MaterialRequestDraft = {
  id: string;
  draft_number: string;
  created_by_user_id: string | null;
  created_at: string;
  status: string;
  items: MaterialRequestDraftItemRow[];
  estimated_total_cost: number;
};

export async function fetchMaterialRequestQueue(companyId: string | null): Promise<MaterialRequestQueueRow[]> {
  const res = await apiFetch<{ items: MaterialRequestQueueRow[] }>(
    withCompany("/api/material-requests/queue", companyId),
  );
  return res.items;
}

export async function patchMaterialRequestQueueItem(
  companyId: string | null,
  queueId: string,
  body: {
    reorder_qty?: number;
    reimbursable?: boolean;
    vendor_part_number?: string;
    unit?: string;
  },
): Promise<MaterialRequestQueueRow> {
  return apiFetch<MaterialRequestQueueRow>(
    withCompany(`/api/material-requests/queue/${encodeURIComponent(queueId)}`, companyId),
    { method: "PATCH", json: body },
  );
}

export async function removeMaterialRequestQueueItem(companyId: string | null, queueId: string): Promise<void> {
  await apiFetch<void>(
    withCompany(`/api/material-requests/queue/${encodeURIComponent(queueId)}/remove`, companyId),
    { method: "POST" },
  );
}

export async function createMaterialRequestDraft(
  companyId: string | null,
  queueItemIds: string[],
): Promise<MaterialRequestDraft> {
  const res = await apiFetch<{ draft: MaterialRequestDraft }>(
    withCompany("/api/material-requests/create-draft", companyId),
    { method: "POST", json: { queue_item_ids: queueItemIds } },
  );
  return res.draft;
}

export async function fetchMaterialRequestDraft(
  companyId: string | null,
  draftId: string,
): Promise<MaterialRequestDraft> {
  return apiFetch<MaterialRequestDraft>(
    withCompany(`/api/material-requests/drafts/${encodeURIComponent(draftId)}`, companyId),
  );
}

export async function submitMaterialRequestDraft(
  companyId: string | null,
  draftId: string,
): Promise<MaterialRequestDraft> {
  return apiFetch<MaterialRequestDraft>(
    withCompany(`/api/material-requests/drafts/${encodeURIComponent(draftId)}/submit`, companyId),
    { method: "POST" },
  );
}

export async function exportMaterialRequestQueue(
  companyId: string | null,
  body: MaterialRequestQueueExportBody,
): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const s = readSession();
  const url = `${base}${withCompany("/api/material-requests/queue/export", companyId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `Export failed (${res.status})`;
    try {
      const err = (await res.json()) as { detail?: string };
      if (typeof err.detail === "string") detail = err.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? `MR-export.xlsx`;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

export async function fetchMaterialRequestExports(
  companyId: string | null,
): Promise<MaterialRequestExportRecord[]> {
  const res = await apiFetch<{ items: MaterialRequestExportRecord[] }>(
    withCompany("/api/material-requests/exports", companyId),
  );
  return res.items;
}

export async function exportMaterialRequestDraft(companyId: string | null, draftId: string): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const s = readSession();
  const url = `${base}${withCompany(`/api/material-requests/drafts/${encodeURIComponent(draftId)}/export`, companyId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? `MR-export.xlsx`;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

export function formatQueueStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
