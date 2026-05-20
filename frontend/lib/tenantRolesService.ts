/** Client for `/api/workers/tenant-roles` — access overlays (additive module templates). */
import { apiFetch } from "@/lib/api";
import type { CanonicalFeatureKey } from "@/lib/features/canonical-features";

export type TenantRoleRow = {
  id: string;
  company_id: string;
  slug: string;
  name: string;
  department_id: string | null;
  feature_keys: CanonicalFeatureKey[];
  user_count: number;
  created_at: string;
};

export type TenantRoleListResponse = {
  items: TenantRoleRow[];
  catalog_feature_keys: CanonicalFeatureKey[];
};

export async function fetchTenantRoles(companyId?: string): Promise<TenantRoleListResponse> {
  const q = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  return apiFetch<TenantRoleListResponse>(`/api/workers/tenant-roles${q}`);
}

export async function createTenantRole(
  body: { name: string; slug?: string; feature_keys: string[] },
  companyId?: string,
): Promise<TenantRoleRow> {
  const q = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  return apiFetch<TenantRoleRow>(`/api/workers/tenant-roles${q}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchTenantRole(
  roleId: string,
  body: { name?: string; feature_keys?: string[] },
  companyId?: string,
): Promise<TenantRoleRow> {
  const q = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  return apiFetch<TenantRoleRow>(`/api/workers/tenant-roles/${roleId}${q}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteTenantRole(roleId: string, companyId?: string): Promise<void> {
  const q = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  await apiFetch<void>(`/api/workers/tenant-roles/${roleId}${q}`, { method: "DELETE" });
}
