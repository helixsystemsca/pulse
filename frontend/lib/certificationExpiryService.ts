/** Certification expiry API (in-app 30/60/90). */
import { apiFetch } from "@/lib/api";

export type CertExpiryRow = {
  id: string;
  user_id: string;
  worker_name: string;
  email: string;
  name: string;
  expiry_date: string | null;
  days: number | null;
  status: string;
  href: string;
};

export type CertExpirySummary = {
  today: string;
  counts: {
    expired: number;
    expiring_30: number;
    expiring_60: number;
    expiring_90: number;
    ok: number;
    no_expiry: number;
    attention: number;
    total: number;
  };
  expired: CertExpiryRow[];
  expiring_30: CertExpiryRow[];
  expiring_60: CertExpiryRow[];
  expiring_90: CertExpiryRow[];
  attention: CertExpiryRow[];
};

export async function fetchCertificationExpiry(companyId?: string | null): Promise<CertExpirySummary> {
  const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  try {
    return await apiFetch<CertExpirySummary>(`/api/workers/certification-expiry${qs}`);
  } catch {
    return apiFetch<CertExpirySummary>(`/api/v1/recreation-ops/command/certification-expiry`);
  }
}
