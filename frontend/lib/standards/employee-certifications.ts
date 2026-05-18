/**
 * Structured employee certifications — maps worker HR rows to canonical registry codes.
 */
import type { WorkerCert, WorkerDetail } from "@/lib/workersService";
import {
  readCompanyCertificationRegistry,
  resolveRegistryEntry,
  type CanonicalCertificationDef,
} from "@/lib/standards/certification-registry";

export type CompetencyState = "qualified" | "in_progress" | "expired" | "revoked";
export type VerificationStatus = "verified" | "pending" | "rejected" | "unverified";

export type EmployeeCertificationRecord = {
  id: string;
  workerId: string;
  workerName: string;
  department: string | null;
  registryCode: string;
  label: string;
  expiryDate: string | null;
  competencyState: CompetencyState;
  verificationStatus: VerificationStatus;
  proofDocumentUrl: string | null;
  issuedAt: string | null;
};

function competencyFromExpiry(expiryDate: string | null, status?: string): CompetencyState {
  if (status === "expired") return "expired";
  if (!expiryDate) return "qualified";
  const exp = new Date(expiryDate);
  if (Number.isNaN(exp.getTime())) return "qualified";
  return exp.getTime() < Date.now() ? "expired" : "qualified";
}

export function employeeCertificationsFromWorkerDetails(
  workers: readonly WorkerDetail[],
  registry: readonly CanonicalCertificationDef[] = readCompanyCertificationRegistry(),
): EmployeeCertificationRecord[] {
  const out: EmployeeCertificationRecord[] = [];
  for (const w of workers) {
    for (const c of w.certifications ?? []) {
      const reg = resolveRegistryEntry(registry, c.name);
      if (!reg) continue;
      out.push({
        id: c.id,
        workerId: w.id,
        workerName: w.full_name ?? w.email,
        department: w.department ?? null,
        registryCode: reg.code,
        label: reg.label,
        expiryDate: c.expiry_date ?? null,
        competencyState: competencyFromExpiry(c.expiry_date ?? null, c.status),
        verificationStatus: "verified",
        proofDocumentUrl: null,
        issuedAt: null,
      });
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label) || a.workerName.localeCompare(b.workerName));
}

export function expiringCertifications(
  rows: readonly EmployeeCertificationRecord[],
  withinDays = 60,
): EmployeeCertificationRecord[] {
  const cutoff = Date.now() + withinDays * 86400000;
  return rows.filter((r) => {
    if (!r.expiryDate) return false;
    const t = new Date(r.expiryDate).getTime();
    return !Number.isNaN(t) && t <= cutoff && t >= Date.now();
  });
}
