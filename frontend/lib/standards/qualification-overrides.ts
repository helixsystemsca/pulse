/**
 * Session-local qualification overrides for demo / UI prototyping until HR API persists edits.
 */
import type { CompetencyState, EmployeeCertificationRecord, VerificationStatus } from "@/lib/standards/employee-certifications";

export type CompetencyOverride = "missing" | "qualified" | "expired";
export type VerificationOverride = "unverified" | "verified";

export type QualificationOverrideEntry = {
  competency?: CompetencyOverride;
  verification?: VerificationOverride;
};

export type QualificationOverridesMap = Record<string, QualificationOverrideEntry>;

const STORAGE_PREFIX = "pulse-qualification-overrides";

function storageKey(companyId: string | null): string {
  return `${STORAGE_PREFIX}:${companyId ?? "default"}`;
}

export function readQualificationOverrides(companyId: string | null = null): QualificationOverridesMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(storageKey(companyId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as QualificationOverridesMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeQualificationOverrides(
  companyId: string | null,
  map: QualificationOverridesMap,
): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(storageKey(companyId), JSON.stringify(map));
}

export function workerRegistryOverrideKey(workerId: string, registryCode: string): string {
  return `${workerId}::${registryCode.trim().toUpperCase()}`;
}

const COMPETENCY_CYCLE: readonly CompetencyOverride[] = ["missing", "qualified", "expired"];
const VERIFICATION_CYCLE: readonly VerificationOverride[] = ["unverified", "verified"];

export function competencyFromRecord(state: CompetencyState): CompetencyOverride {
  if (state === "expired") return "expired";
  if (state === "qualified") return "qualified";
  return "missing";
}

export function getEffectiveCompetency(
  record: Pick<EmployeeCertificationRecord, "id" | "workerId" | "registryCode" | "competencyState">,
  overrides: QualificationOverridesMap,
): CompetencyOverride {
  const byId = overrides[record.id]?.competency;
  if (byId) return byId;
  const byCode = overrides[workerRegistryOverrideKey(record.workerId, record.registryCode)]?.competency;
  if (byCode) return byCode;
  return competencyFromRecord(record.competencyState);
}

export function getEffectiveVerification(
  record: Pick<EmployeeCertificationRecord, "id" | "workerId" | "registryCode" | "verificationStatus">,
  overrides: QualificationOverridesMap,
): VerificationOverride {
  const byId = overrides[record.id]?.verification;
  if (byId) return byId;
  const byCode = overrides[workerRegistryOverrideKey(record.workerId, record.registryCode)]?.verification;
  if (byCode) return byCode;
  return record.verificationStatus === "verified" ? "verified" : "unverified";
}

function mirrorEntryForRecord(
  record: Pick<EmployeeCertificationRecord, "id" | "workerId" | "registryCode">,
  entry: QualificationOverrideEntry,
): QualificationOverridesMap {
  const codeKey = workerRegistryOverrideKey(record.workerId, record.registryCode);
  return {
    [record.id]: entry,
    [codeKey]: entry,
  };
}

export function cycleCompetencyOverride(
  record: Pick<EmployeeCertificationRecord, "id" | "workerId" | "registryCode" | "competencyState">,
  overrides: QualificationOverridesMap,
): QualificationOverridesMap {
  const current = getEffectiveCompetency(record, overrides);
  const next = COMPETENCY_CYCLE[(COMPETENCY_CYCLE.indexOf(current) + 1) % COMPETENCY_CYCLE.length]!;
  const entry: QualificationOverrideEntry = {
    ...overrides[record.id],
    ...overrides[workerRegistryOverrideKey(record.workerId, record.registryCode)],
    competency: next,
  };
  return { ...overrides, ...mirrorEntryForRecord(record, entry) };
}

export function cycleVerificationOverride(
  record: Pick<EmployeeCertificationRecord, "id" | "workerId" | "registryCode" | "verificationStatus">,
  overrides: QualificationOverridesMap,
): QualificationOverridesMap {
  const current = getEffectiveVerification(record, overrides);
  const next = VERIFICATION_CYCLE[(VERIFICATION_CYCLE.indexOf(current) + 1) % VERIFICATION_CYCLE.length]!;
  const entry: QualificationOverrideEntry = {
    ...overrides[record.id],
    ...overrides[workerRegistryOverrideKey(record.workerId, record.registryCode)],
    verification: next,
  };
  return { ...overrides, ...mirrorEntryForRecord(record, entry) };
}

export function setSyntheticCertOverride(
  workerId: string,
  registryCode: string,
  overrides: QualificationOverridesMap,
  entry: QualificationOverrideEntry = { competency: "missing", verification: "unverified" },
): QualificationOverridesMap {
  const key = workerRegistryOverrideKey(workerId, registryCode);
  return { ...overrides, [key]: { ...overrides[key], ...entry } };
}

export function applyOverridesToCertificationRows(
  rows: readonly EmployeeCertificationRecord[],
  overrides: QualificationOverridesMap,
): EmployeeCertificationRecord[] {
  return rows.map((r) => {
    const competency = getEffectiveCompetency(r, overrides);
    const verification = getEffectiveVerification(r, overrides);
    return {
      ...r,
      competencyState: competency === "expired" ? "expired" : competency === "qualified" ? "qualified" : "in_progress",
      verificationStatus: verification === "verified" ? "verified" : "unverified",
    };
  });
}

export function workerEffectiveCertificationCodes(
  worker: { id: string; certifications?: string[] | null },
  overrides: QualificationOverridesMap = readQualificationOverrides(),
): string[] {
  const codes = new Set((worker.certifications ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean));

  for (const [key, entry] of Object.entries(overrides)) {
    if (!key.includes("::")) continue;
    const [workerId, code] = key.split("::");
    if (workerId !== worker.id || !code) continue;
    if (entry.competency === "qualified") codes.add(code);
    else if (entry.competency === "missing" || entry.competency === "expired") codes.delete(code);
  }

  return [...codes];
}

export function workerQualificationCounts(
  certifications: readonly Pick<EmployeeCertificationRecord, "competencyState" | "verificationStatus" | "proofDocumentUrl" | "expiryDate">[],
  expiringIds: ReadonlySet<string>,
  recordIds: readonly string[],
): { qualifiedCount: number; expiredCount: number; expiringCount: number; missingProofCount: number } {
  let qualifiedCount = 0;
  let expiredCount = 0;
  let expiringCount = 0;
  let missingProofCount = 0;

  certifications.forEach((c, i) => {
    const id = recordIds[i];
    if (c.competencyState === "qualified") qualifiedCount += 1;
    if (c.competencyState === "expired") expiredCount += 1;
    if (id && expiringIds.has(id)) expiringCount += 1;
    if (!c.proofDocumentUrl && c.competencyState !== "revoked") missingProofCount += 1;
  });

  return { qualifiedCount, expiredCount, expiringCount, missingProofCount };
}
