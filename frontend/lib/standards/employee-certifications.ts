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

export function expiredCertifications(rows: readonly EmployeeCertificationRecord[]): EmployeeCertificationRecord[] {
  return rows.filter((r) => r.competencyState === "expired");
}

export function missingProofCertifications(rows: readonly EmployeeCertificationRecord[]): EmployeeCertificationRecord[] {
  return rows.filter((r) => !r.proofDocumentUrl && r.competencyState !== "revoked");
}

export function pendingVerificationCertifications(
  rows: readonly EmployeeCertificationRecord[],
): EmployeeCertificationRecord[] {
  return rows.filter((r) => r.verificationStatus === "pending" || r.verificationStatus === "unverified");
}

export type WorkerQualificationSummary = {
  workerId: string;
  workerName: string;
  department: string | null;
  certifications: EmployeeCertificationRecord[];
  qualifiedCount: number;
  expiringCount: number;
  expiredCount: number;
  missingProofCount: number;
};

export function groupCertificationsByWorker(
  rows: readonly EmployeeCertificationRecord[],
): WorkerQualificationSummary[] {
  const map = new Map<string, WorkerQualificationSummary>();
  for (const r of rows) {
    let entry = map.get(r.workerId);
    if (!entry) {
      entry = {
        workerId: r.workerId,
        workerName: r.workerName,
        department: r.department,
        certifications: [],
        qualifiedCount: 0,
        expiringCount: 0,
        expiredCount: 0,
        missingProofCount: 0,
      };
      map.set(r.workerId, entry);
    }
    entry.certifications.push(r);
    if (r.competencyState === "qualified") entry.qualifiedCount += 1;
    if (r.competencyState === "expired") entry.expiredCount += 1;
    if (!r.proofDocumentUrl) entry.missingProofCount += 1;
  }
  const expiring = new Set(expiringCertifications(rows).map((r) => r.id));
  for (const entry of map.values()) {
    entry.expiringCount = entry.certifications.filter((c) => expiring.has(c.id)).length;
  }
  return [...map.values()].sort((a, b) => a.workerName.localeCompare(b.workerName));
}

export type RegistryCoverageStats = {
  code: string;
  label: string;
  qualified: number;
  expiringSoon: number;
  missingProof: number;
  holders: EmployeeCertificationRecord[];
};

export function registryCoverageStats(
  registry: readonly CanonicalCertificationDef[],
  rows: readonly EmployeeCertificationRecord[],
  expiringWithinDays = 60,
): RegistryCoverageStats[] {
  const expiringIds = new Set(expiringCertifications(rows, expiringWithinDays).map((r) => r.id));
  return registry
    .filter((r) => r.active !== false)
    .map((def) => {
      const holders = rows.filter((row) => row.registryCode === def.code);
      return {
        code: def.code,
        label: def.label,
        qualified: holders.filter((h) => h.competencyState === "qualified").length,
        expiringSoon: holders.filter((h) => expiringIds.has(h.id)).length,
        missingProof: holders.filter((h) => !h.proofDocumentUrl).length,
        holders,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
