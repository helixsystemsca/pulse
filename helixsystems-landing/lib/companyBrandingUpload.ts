import { apiPostFormData } from "@/lib/api";

type CompanyLogoUploadOut = {
  logo_url?: string | null;
  header_image_url?: string | null;
  message?: string;
};

/** Tenant company admin: POST /api/v1/company/logo */
export async function uploadTenantCompanyLogoFile(file: File): Promise<CompanyLogoUploadOut> {
  const fd = new FormData();
  fd.set("file", file);
  return apiPostFormData<CompanyLogoUploadOut>("/api/v1/company/logo", fd);
}

/** System operator: POST /api/system/companies/{companyId}/logo */
export async function uploadSystemCompanyLogoFile<T = CompanyLogoUploadOut>(
  companyId: string,
  file: File,
): Promise<T> {
  const fd = new FormData();
  fd.set("file", file);
  return apiPostFormData<T>(`/api/system/companies/${encodeURIComponent(companyId)}/logo`, fd);
}
