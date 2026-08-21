/** Recreation ops foundation API — `/api/v1/recreation-ops/{entityType}`. */
import { apiFetch } from "@/lib/api";
import type { OpsEntityType } from "@/lib/recreation/ops-modules";

export type OpsLink = {
  id: string;
  from_type: string;
  from_id: string;
  to_type: string;
  to_id: string;
  link_role: string;
  created_at: string;
};

export type OpsRecord = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  status: string;
  tags: string[];
  attachments: unknown[];
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  links: OpsLink[];
  [key: string]: unknown;
};

export type OpsRevision = {
  id: string;
  entity_type: string;
  entity_id: string;
  revision: number;
  snapshot: Record<string, unknown>;
  changed_by_user_id: string | null;
  created_at: string;
};

function base(entityType: OpsEntityType): string {
  return `/api/v1/recreation-ops/${entityType}`;
}

export async function listOpsRecords(
  entityType: OpsEntityType,
  params?: { q?: string; status?: string; tag?: string },
): Promise<OpsRecord[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.status) qs.set("status", params.status);
  if (params?.tag) qs.set("tag", params.tag);
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<OpsRecord[]>(`${base(entityType)}${suffix}`);
}

export async function getOpsRecord(entityType: OpsEntityType, id: string): Promise<OpsRecord> {
  return apiFetch<OpsRecord>(`${base(entityType)}/${id}`);
}

export async function createOpsRecord(
  entityType: OpsEntityType,
  body: Record<string, unknown>,
): Promise<OpsRecord> {
  return apiFetch<OpsRecord>(base(entityType), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function patchOpsRecord(
  entityType: OpsEntityType,
  id: string,
  body: Record<string, unknown>,
): Promise<OpsRecord> {
  return apiFetch<OpsRecord>(`${base(entityType)}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteOpsRecord(entityType: OpsEntityType, id: string): Promise<void> {
  await apiFetch(`${base(entityType)}/${id}`, { method: "DELETE" });
}

export async function addOpsLink(
  entityType: OpsEntityType,
  id: string,
  to_type: OpsEntityType,
  to_id: string,
  link_role = "related",
): Promise<OpsLink> {
  return apiFetch<OpsLink>(`${base(entityType)}/${id}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to_type, to_id, link_role }),
  });
}

export async function removeOpsLink(
  entityType: OpsEntityType,
  id: string,
  linkId: string,
): Promise<void> {
  await apiFetch(`${base(entityType)}/${id}/links/${linkId}`, { method: "DELETE" });
}

export async function listOpsRevisions(
  entityType: OpsEntityType,
  id: string,
): Promise<OpsRevision[]> {
  return apiFetch<OpsRevision[]>(`${base(entityType)}/${id}/revisions`);
}
