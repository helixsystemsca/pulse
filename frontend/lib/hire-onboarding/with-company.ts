export function withCompanyQuery(path: string, companyId: string | null): string {
  if (!companyId) return path;
  return path.includes("?") ? `${path}&company_id=${encodeURIComponent(companyId)}` : `${path}?company_id=${encodeURIComponent(companyId)}`;
}
