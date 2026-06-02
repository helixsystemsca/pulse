import { apiFetch } from "@/lib/api";

export type TenantDepartmentRow = {
  id: string;
  company_id: string;
  slug: string;
  name: string;
  created_at: string;
};

export type TenantDepartmentListResponse = {
  items: TenantDepartmentRow[];
};

export async function fetchTenantDepartments(companyId?: string | null): Promise<TenantDepartmentRow[]> {
  const q = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  const out = await apiFetch<TenantDepartmentListResponse>(`/api/workers/tenant-departments${q}`);
  return out.items;
}

export async function createTenantDepartment(
  body: { name: string; slug?: string },
  companyId?: string | null,
): Promise<TenantDepartmentRow> {
  const q = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  return apiFetch<TenantDepartmentRow>(`/api/workers/tenant-departments${q}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchTenantDepartment(
  departmentId: string,
  body: { name: string },
  companyId?: string | null,
): Promise<TenantDepartmentRow> {
  const q = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  return apiFetch<TenantDepartmentRow>(`/api/workers/tenant-departments/${departmentId}${q}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteTenantDepartment(departmentId: string, companyId?: string | null): Promise<void> {
  const q = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  await apiFetch<void>(`/api/workers/tenant-departments/${departmentId}${q}`, { method: "DELETE" });
}

export function departmentNameForSlug(departments: TenantDepartmentRow[], slug: string | null | undefined): string {
  if (!slug) return "—";
  return departments.find((d) => d.slug === slug)?.name ?? slug;
}

export function tenantDepartmentOptions(
  departments: TenantDepartmentRow[],
): { value: string; label: string }[] {
  return departments.map((d) => ({ value: d.slug, label: d.name }));
}

export function tenantDepartmentNamesBySlug(departments: TenantDepartmentRow[]): Record<string, string> {
  return Object.fromEntries(departments.map((d) => [d.slug, d.name]));
}
