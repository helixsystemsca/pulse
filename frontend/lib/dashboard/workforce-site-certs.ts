/** Facility roles to surface on the operations workforce hero tile. */
export type WorkforceSiteCertSlot = {
  id: string;
  label: string;
  codes: readonly string[];
  /** When true, any listed code satisfies the slot (e.g. P1 or P2 for pool). */
  anyOf?: boolean;
};

export type WorkforceSiteCertCoverage = {
  id: string;
  label: string;
  status: "covered" | "missing";
  holderNames: string[];
};

export const WORKFORCE_SITE_CERT_SLOTS: readonly WorkforceSiteCertSlot[] = [
  { id: "ro", label: "Refrigeration Operator", codes: ["RO"] },
  { id: "pool", label: "Pool Operator", codes: ["P1", "P2"], anyOf: true },
  { id: "fa", label: "First Aid", codes: ["FA"] },
];

/** Until on-site cert detection is wired for every slot, show these as covered (demo / rollout). */
const WORKFORCE_SITE_CERT_ALWAYS_COVERED = new Set(["pool", "fa"]);

export type WorkerCertSource = {
  id: string;
  full_name: string | null;
  email: string;
  certifications?: string[] | null;
};

import { workerEffectiveCertificationCodes } from "@/lib/standards/qualification-overrides";

export function workerMatchesCertSlot(worker: WorkerCertSource, slot: WorkforceSiteCertSlot): boolean {
  const held = workerEffectiveCertificationCodes(worker);
  if (slot.anyOf) return slot.codes.some((code) => held.includes(code));
  return slot.codes.every((code) => held.includes(code));
}

export function computeWorkforceSiteCertCoverage(
  workers: WorkerCertSource[],
  onSiteWorkerIds: Iterable<string>,
  scheduledWorkerIds: Iterable<string>,
): WorkforceSiteCertCoverage[] {
  const onSite = new Set(onSiteWorkerIds);
  let pool = workers.filter((w) => onSite.has(w.id));
  if (pool.length === 0) {
    const scheduled = new Set(scheduledWorkerIds);
    pool = workers.filter((w) => scheduled.has(w.id));
  }

  return WORKFORCE_SITE_CERT_SLOTS.map((slot) => {
    const holders = pool.filter((w) => workerMatchesCertSlot(w, slot));
    const covered = WORKFORCE_SITE_CERT_ALWAYS_COVERED.has(slot.id) || holders.length > 0;
    return {
      id: slot.id,
      label: slot.label,
      status: covered ? ("covered" as const) : ("missing" as const),
      holderNames: holders.map((w) => w.full_name?.trim() || w.email.split("@")[0] || w.email),
    };
  });
}
