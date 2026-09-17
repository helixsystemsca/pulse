/**
 * Training / certification eligibility for schedule assignments.
 * Warn-only: callers persist the placement and show alarms — they must not silently drop the assignment.
 */

import { certificationLabel } from "@/lib/schedule/certifications";
import type { Shift, Worker } from "@/lib/schedule/types";
import { workerEffectiveCertificationCodes } from "@/lib/standards/qualification-overrides";

const CERT_SYNONYMS: Record<string, string> = {
  RO: "RO",
  "REFRIGERATION OPERATOR": "RO",
  P1: "P1",
  "POOL OPERATOR LEVEL 1": "P1",
  "POOL OPERATOR 1": "P1",
  "PO 1": "P1",
  P2: "P2",
  "POOL OPERATOR LEVEL 2": "P2",
  "POOL OPERATOR 2": "P2",
  "PO 2": "P2",
  P4: "P4",
  "4TH CLASS POWER ENGINEER": "P4",
  "FOURTH CLASS POWER ENGINEER": "P4",
  FA: "FA",
  "FIRST AID": "FA",
  WHMIS: "WHMIS",
  FORKLIFT: "FORKLIFT",
  "FORKLIFT OPERATOR": "FORKLIFT",
  NLS: "NLS",
  NL: "NLS",
  LIFEGUARD: "NLS",
  LIFEGUARDING: "NLS",
  "LIFE GUARD": "NLS",
  "NATIONAL LIFEGUARD": "NLS",
  "NATIONAL LIFEGUARD SERVICE": "NLS",
  "NATIONAL LIFESAVING": "NLS",
  "NLS POOL": "NLS",
  "NLS WATERFRONT": "NLS",
  "NATIONAL LIFEGUARD POOL": "NLS",
};

export type WorkerCredentialStatus = "valid" | "expired" | "no_expiry";

export type WorkerCertificationRecord = {
  name: string;
  code?: string;
  expiryDate?: string | null;
  status?: WorkerCredentialStatus | string;
};

export type CertRequirement = {
  code: string;
  facilityId?: string | null;
};

export type AssignmentAlarmKind = "training_missing" | "training_expired";

export type AssignmentAlarm = {
  code: AssignmentAlarmKind;
  severity: "warning" | "critical";
  label: string;
  kind: "training";
  requirementCode: string;
};

export type WorkerCredentialState = {
  qualified: Set<string>;
  expired: Set<string>;
};

export function normalizeCredentialCode(raw: string | null | undefined): string {
  if (!raw) return "";
  const key = raw.trim().toUpperCase().replace(/\s+/g, " ");
  if (!key) return "";
  return CERT_SYNONYMS[key] ?? (key.includes(" ") ? key.replace(/ /g, "_") : key);
}

function expandCertRequirementItems(raw: unknown): unknown[] {
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: unknown[] = [];
  for (const item of items) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      const anyOf = o.any_of ?? o.anyOf;
      if (Array.isArray(anyOf)) {
        out.push(...anyOf);
        continue;
      }
    }
    out.push(item);
  }
  return out;
}

export function certRequirementsAcceptAny(raw: unknown): boolean {
  if (!raw) return false;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (o.accepts_any === true || o.acceptsAny === true || o.match === "any") return true;
    if (Array.isArray(o.any_of) || Array.isArray(o.anyOf)) return true;
  }
  const items = Array.isArray(raw) ? raw : [raw];
  return items.some((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const o = item as Record<string, unknown>;
    return o.accepts_any === true || o.acceptsAny === true || o.match === "any" || Array.isArray(o.any_of) || Array.isArray(o.anyOf);
  });
}

export function parseCertRequirements(raw: unknown): CertRequirement[] {
  if (!raw) return [];
  const items = expandCertRequirementItems(raw);
  const out: CertRequirement[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    let code = "";
    let facilityId: string | null = null;
    if (typeof item === "string") {
      code = normalizeCredentialCode(item);
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      code = normalizeCredentialCode(String(o.code ?? o.name ?? o.certification ?? ""));
      const fid = o.facility_id ?? o.facilityId ?? o.zone_id;
      if (fid != null && String(fid).trim()) facilityId = String(fid);
    }
    if (!code) continue;
    const key = `${code}:${facilityId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ code, facilityId });
  }
  return out;
}

export function serializeCertRequirements(reqs: readonly CertRequirement[]): Array<string | { code: string; facility_id: string }> {
  return reqs.map((r) => (r.facilityId ? { code: r.code, facility_id: r.facilityId } : r.code));
}

export function requirementAppliesToFacility(req: CertRequirement, facilityId: string | null | undefined): boolean {
  if (!req.facilityId) return true;
  if (!facilityId) return true;
  return req.facilityId === facilityId;
}

function expiryStatus(expiryDate: string | null | undefined, nowMs = Date.now()): WorkerCredentialStatus {
  if (!expiryDate) return "no_expiry";
  const t = new Date(expiryDate).getTime();
  if (Number.isNaN(t)) return "no_expiry";
  return t < nowMs ? "expired" : "valid";
}

export function buildWorkerCredentialState(
  worker: Pick<Worker, "id" | "certifications" | "certificationRecords" | "completedTraining">,
  nowMs = Date.now(),
): WorkerCredentialState {
  const qualified = new Set<string>();
  const expired = new Set<string>();

  for (const rec of worker.certificationRecords ?? []) {
    const code = normalizeCredentialCode(rec.code ?? rec.name);
    if (!code) continue;
    const status = (rec.status || expiryStatus(rec.expiryDate ?? null, nowMs)).toLowerCase();
    if (status === "expired") expired.add(code);
    else qualified.add(code);
  }

  for (const raw of worker.certifications ?? []) {
    const code = normalizeCredentialCode(raw);
    if (!code || expired.has(code)) continue;
    qualified.add(code);
  }

  for (const raw of worker.completedTraining ?? []) {
    const code = normalizeCredentialCode(raw);
    if (!code || expired.has(code)) continue;
    qualified.add(code);
  }

  for (const code of workerEffectiveCertificationCodes(worker)) {
    const n = normalizeCredentialCode(code);
    if (!n || expired.has(n)) continue;
    qualified.add(n);
  }

  for (const code of expired) qualified.delete(code);
  return { qualified, expired };
}

function alarmFor(req: CertRequirement, expired: boolean): AssignmentAlarm {
  const label = certificationLabel(req.code);
  const facilityBit = req.facilityId ? (expired ? " at this facility" : " for this facility") : "";
  if (expired) {
    return {
      code: "training_expired",
      severity: "critical",
      label: `${label} expired${facilityBit}`,
      kind: "training",
      requirementCode: req.code,
    };
  }
  return {
    code: "training_missing",
    severity: "critical",
    label: `Missing ${label}${facilityBit}`,
    kind: "training",
    requirementCode: req.code,
  };
}

export function evaluateAssignmentTraining(
  required: readonly CertRequirement[],
  worker: WorkerCredentialState,
  opts?: { facilityId?: string | null; acceptsAny?: boolean },
): AssignmentAlarm[] {
  const applicable = required.filter((r) => requirementAppliesToFacility(r, opts?.facilityId));
  if (!applicable.length) return [];

  if (opts?.acceptsAny) {
    if (applicable.some((r) => worker.qualified.has(r.code))) return [];
    const expired = applicable.find((r) => worker.expired.has(r.code));
    if (expired) return [alarmFor(expired, true)];
    return [
      {
        code: "training_missing",
        severity: "critical",
        label:
          applicable.length === 1
            ? `Missing ${certificationLabel(applicable[0]!.code)}`
            : `Requires one of: ${applicable.map((r) => certificationLabel(r.code)).join(", ")}`,
        kind: "training",
        requirementCode: applicable[0]!.code,
      },
    ];
  }

  const alarms: AssignmentAlarm[] = [];
  const seen = new Set<string>();
  for (const req of applicable) {
    if (worker.qualified.has(req.code)) continue;
    const key = `${req.code}:${req.facilityId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    alarms.push(alarmFor(req, worker.expired.has(req.code)));
  }
  return alarms;
}

export function requiredCertsForShift(
  shift: Pick<Shift, "required_certifications" | "shiftDefinitionId" | "shiftCode" | "zoneId">,
  definitions?: Array<{
    id: string;
    code: string;
    cert_requirements?: unknown;
  }>,
): CertRequirement[] {
  const fromShift = parseCertRequirements(shift.required_certifications);
  if (fromShift.length) return fromShift;
  if (!definitions?.length) return [];
  const byId = shift.shiftDefinitionId
    ? definitions.find((d) => d.id === shift.shiftDefinitionId)
    : undefined;
  const byCode = shift.shiftCode
    ? definitions.find((d) => d.code.trim().toUpperCase() === shift.shiftCode!.trim().toUpperCase())
    : undefined;
  const def = byId ?? byCode;
  return parseCertRequirements(def?.cert_requirements);
}

export function evaluateShiftAssignmentAlarms(
  shift: Pick<Shift, "eventType" | "workerId" | "required_certifications" | "accepts_any_certification" | "shiftDefinitionId" | "shiftCode" | "zoneId">,
  worker: Pick<Worker, "id" | "certifications" | "certificationRecords" | "completedTraining"> | null | undefined,
  definitions?: Array<{ id: string; code: string; cert_requirements?: unknown }>,
): AssignmentAlarm[] {
  if (shift.eventType !== "work" || !shift.workerId || !worker) return [];
  const required = requiredCertsForShift(shift, definitions);
  if (!required.length) return [];
  let defAcceptsAny = false;
  if (definitions?.length) {
    const byId = shift.shiftDefinitionId
      ? definitions.find((d) => d.id === shift.shiftDefinitionId)
      : undefined;
    const byCode = shift.shiftCode
      ? definitions.find((d) => d.code.trim().toUpperCase() === shift.shiftCode!.trim().toUpperCase())
      : undefined;
    defAcceptsAny = certRequirementsAcceptAny((byId ?? byCode)?.cert_requirements);
  }
  return evaluateAssignmentTraining(required, buildWorkerCredentialState(worker), {
    facilityId: shift.zoneId,
    acceptsAny: shift.accepts_any_certification === true || defAcceptsAny,
  });
}

export function assignmentAlarmSummary(alarms: readonly AssignmentAlarm[]): string {
  return alarms.map((a) => a.label).join(" · ");
}
