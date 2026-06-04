import { apiFetch } from "@/lib/api";
import { PERMISSION_MATRIX_DEPARTMENTS } from "@/config/platform/permission-matrix";

const DEPARTMENT_SLUG_RE = /^[a-z][a-z0-9_-]{0,63}$/;

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
    json: body,
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
    json: body,
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

export function isTenantDepartmentSlugFormat(slug: string): boolean {
  return DEPARTMENT_SLUG_RE.test(slug.trim().toLowerCase());
}

/** Tenant-configured slug or legacy Panorama matrix department. */
export function isAllowedDepartmentSlug(
  slug: string,
  tenantDepartments: readonly { slug: string }[],
): boolean {
  const n = slug.trim().toLowerCase();
  if (!isTenantDepartmentSlugFormat(n)) return false;
  if (tenantDepartments.some((d) => d.slug === n)) return true;
  return (PERMISSION_MATRIX_DEPARTMENTS as readonly string[]).includes(n);
}

/** HR department suitable for `/dashboard/department/{slug}` (not maintenance / worker home). */
export function isHrDepartmentDashboardSlug(
  dept: string | null | undefined,
  tenantDepartments: readonly { slug: string }[],
): boolean {
  const n = (dept ?? "").trim().toLowerCase();
  if (!n || n === "maintenance") return false;
  return isAllowedDepartmentSlug(n, tenantDepartments);
}
