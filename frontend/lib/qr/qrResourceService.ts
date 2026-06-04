import { apiFetch } from "@/lib/api";
import type { QrGuestAccessLevel, QrResourceType } from "@/lib/qr/qr-resource-types";

function withCompany(path: string, companyId: string | null): string {
  if (!companyId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}company_id=${encodeURIComponent(companyId)}`;
}

export type QrResourceRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  resource_type: QrResourceType | string;
  resource_id: string;
  qr_token: string;
  qr_url: string;
  guest_access_enabled: boolean;
  guest_access_level: QrGuestAccessLevel | string;
  linked_resource_label: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type QrResolveResult = {
  qr_token: string;
  name: string;
  description: string | null;
  resource_type: string;
  resource_id: string;
  destination_path: string;
  guest_destination_path: string | null;
  guest_access_enabled: boolean;
  guest_access_level: string;
  requires_auth: boolean;
  guest_payload: Record<string, unknown> | null;
};

export type QrResourceOption = {
  id: string;
  label: string;
  subtitle: string | null;
};

export async function fetchQrResources(
  companyId: string | null,
  params?: { q?: string; resource_type?: string },
): Promise<QrResourceRow[]> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.resource_type) search.set("resource_type", params.resource_type);
  const qs = search.toString();
  const res = await apiFetch<{ items: QrResourceRow[] }>(
    withCompany(`/api/qr/resources${qs ? `?${qs}` : ""}`, companyId),
  );
  return res.items;
}

export async function fetchQrResourceOptions(
  companyId: string | null,
  resourceType: string,
  q?: string,
): Promise<QrResourceOption[]> {
  const search = new URLSearchParams({ resource_type: resourceType });
  if (q) search.set("q", q);
  const res = await apiFetch<{ items: QrResourceOption[] }>(
    withCompany(`/api/qr/resources/options?${search}`, companyId),
  );
  return res.items;
}

export async function createQrResource(
  companyId: string | null,
  body: {
    name: string;
    description?: string;
    resource_type: string;
    resource_id: string;
    guest_access_enabled: boolean;
    guest_access_level: string;
  },
): Promise<QrResourceRow> {
  return apiFetch<QrResourceRow>(withCompany("/api/qr/resources", companyId), {
    method: "POST",
    json: body,
  });
}

export async function patchQrResource(
  companyId: string | null,
  id: string,
  body: Partial<{
    name: string;
    description: string;
    resource_type: string;
    resource_id: string;
    guest_access_enabled: boolean;
    guest_access_level: string;
  }>,
): Promise<QrResourceRow> {
  return apiFetch<QrResourceRow>(withCompany(`/api/qr/resources/${encodeURIComponent(id)}`, companyId), {
    method: "PATCH",
    json: body,
  });
}

export async function deleteQrResource(companyId: string | null, id: string): Promise<void> {
  await apiFetch<void>(withCompany(`/api/qr/resources/${encodeURIComponent(id)}`, companyId), {
    method: "DELETE",
  });
}

export async function regenerateQrToken(companyId: string | null, id: string): Promise<QrResourceRow> {
  return apiFetch<QrResourceRow>(
    withCompany(`/api/qr/resources/${encodeURIComponent(id)}/regenerate-token`, companyId),
    { method: "POST" },
  );
}

export async function resolveQrTokenPublic(token: string, guest = false): Promise<QrResolveResult> {
  const qs = guest ? "?guest=1" : "";
  return apiFetch<QrResolveResult>(`/api/public/qr/resolve/${encodeURIComponent(token)}${qs}`);
}

export async function resolveQrTokenAuthenticated(
  token: string,
  guest = false,
): Promise<QrResolveResult> {
  const qs = guest ? "?guest=1" : "";
  return apiFetch<QrResolveResult>(`/api/qr/resolve/${encodeURIComponent(token)}${qs}`);
}
