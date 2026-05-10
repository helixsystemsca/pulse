/**
 * Tenant contractor directory under `/api/inventory/contractors`.
 * Same shape as vendors; system administrators pass `company_id` as with other inventory APIs.
 */
import { apiFetch } from "@/lib/api";

export type InventoryContractorRow = {
  id: string;
  company_id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  account_number: string | null;
  payment_terms: string | null;
  item_specialty: string | null;
  notes: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InventoryContractorCreateBody = {
  name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  account_number?: string | null;
  payment_terms?: string | null;
  item_specialty?: string | null;
  notes?: string | null;
  website?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country?: string | null;
  is_active?: boolean;
};

export type InventoryContractorPatchBody = Partial<InventoryContractorCreateBody>;

export type InventoryContractorListFilters = Partial<{
  name_contains: string;
  contact_name_contains: string;
  contact_email_contains: string;
  contact_phone_contains: string;
  account_number_contains: string;
  payment_terms_contains: string;
  item_specialty_contains: string;
  notes_contains: string;
  website_contains: string;
  address_line1_contains: string;
  address_line2_contains: string;
  city_contains: string;
  region_contains: string;
  postal_code_contains: string;
  country_contains: string;
  active: boolean;
}>;

function withCompany(path: string, companyId: string | null): string {
  const qs = companyId ? `company_id=${encodeURIComponent(companyId)}` : "";
  const join = path.includes("?") ? "&" : "?";
  return qs ? `${path}${join}${qs}` : path;
}

export function buildInventoryContractorsQuery(
  companyId: string | null,
  filters: InventoryContractorListFilters,
): string {
  const sp = new URLSearchParams();
  if (companyId) sp.set("company_id", companyId);
  const entries: [string, string][] = [];
  if (filters.name_contains?.trim()) entries.push(["name_contains", filters.name_contains.trim()]);
  if (filters.contact_name_contains?.trim()) entries.push(["contact_name_contains", filters.contact_name_contains.trim()]);
  if (filters.contact_email_contains?.trim()) entries.push(["contact_email_contains", filters.contact_email_contains.trim()]);
  if (filters.contact_phone_contains?.trim()) entries.push(["contact_phone_contains", filters.contact_phone_contains.trim()]);
  if (filters.account_number_contains?.trim()) entries.push(["account_number_contains", filters.account_number_contains.trim()]);
  if (filters.payment_terms_contains?.trim()) entries.push(["payment_terms_contains", filters.payment_terms_contains.trim()]);
  if (filters.item_specialty_contains?.trim()) entries.push(["item_specialty_contains", filters.item_specialty_contains.trim()]);
  if (filters.notes_contains?.trim()) entries.push(["notes_contains", filters.notes_contains.trim()]);
  if (filters.website_contains?.trim()) entries.push(["website_contains", filters.website_contains.trim()]);
  if (filters.address_line1_contains?.trim()) entries.push(["address_line1_contains", filters.address_line1_contains.trim()]);
  if (filters.address_line2_contains?.trim()) entries.push(["address_line2_contains", filters.address_line2_contains.trim()]);
  if (filters.city_contains?.trim()) entries.push(["city_contains", filters.city_contains.trim()]);
  if (filters.region_contains?.trim()) entries.push(["region_contains", filters.region_contains.trim()]);
  if (filters.postal_code_contains?.trim()) entries.push(["postal_code_contains", filters.postal_code_contains.trim()]);
  if (filters.country_contains?.trim()) entries.push(["country_contains", filters.country_contains.trim()]);
  if (filters.active !== undefined) entries.push(["active", filters.active ? "true" : "false"]);
  for (const [k, v] of entries) sp.set(k, v);
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export async function fetchInventoryContractors(
  companyId: string | null,
  filters: InventoryContractorListFilters,
): Promise<InventoryContractorRow[]> {
  const q = buildInventoryContractorsQuery(companyId, filters);
  return apiFetch<InventoryContractorRow[]>(`/api/inventory/contractors${q}`);
}

export async function createInventoryContractor(
  companyId: string | null,
  body: InventoryContractorCreateBody,
): Promise<InventoryContractorRow> {
  return apiFetch<InventoryContractorRow>(withCompany(`/api/inventory/contractors`, companyId), {
    method: "POST",
    json: body,
  });
}

export async function patchInventoryContractor(
  companyId: string | null,
  id: string,
  body: InventoryContractorPatchBody,
): Promise<InventoryContractorRow> {
  return apiFetch<InventoryContractorRow>(withCompany(`/api/inventory/contractors/${encodeURIComponent(id)}`, companyId), {
    method: "PATCH",
    json: body,
  });
}

export async function deleteInventoryContractor(companyId: string | null, id: string): Promise<void> {
  await apiFetch<void>(withCompany(`/api/inventory/contractors/${encodeURIComponent(id)}`, companyId), {
    method: "DELETE",
  });
}
