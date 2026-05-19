import { can } from "@/lib/rbac/session-access";
import type { PulseAuthSession } from "@/lib/pulse-session";

export const WORKFORCE_TRAINING_SECTIONS = [
  "overview",
  "workers",
  "certifications",
  "compliance",
  "expiring",
] as const;

export type WorkforceTrainingSection = (typeof WORKFORCE_TRAINING_SECTIONS)[number];

export function isWorkforceTrainingSection(value: string): value is WorkforceTrainingSection {
  return (WORKFORCE_TRAINING_SECTIONS as readonly string[]).includes(value);
}

const SECTION_PERMISSION: Record<WorkforceTrainingSection, string> = {
  overview: "standards.training.overview.view",
  workers: "standards.training.workers.view",
  certifications: "standards.training.certifications.view",
  compliance: "standards.training.compliance.view",
  expiring: "standards.training.expiring.view",
};

const SECTION_LEGACY_FALLBACK: Record<WorkforceTrainingSection, string[]> = {
  overview: ["standards.training.view", "procedures.view"],
  workers: ["standards.training.view", "standards.certifications.view", "procedures.view"],
  certifications: ["standards.certifications.view", "standards.certifications.manage", "procedures.view"],
  compliance: ["standards.compliance.view", "standards.compliance.manage", "procedures.view"],
  expiring: [
    "standards.compliance.view",
    "standards.certifications.view",
    "standards.training.view",
    "procedures.view",
  ],
};

export function canViewWorkforceTrainingSection(
  session: PulseAuthSession | null,
  section: WorkforceTrainingSection,
): boolean {
  if (!session) return false;
  if (can(session, SECTION_PERMISSION[section])) return true;
  return SECTION_LEGACY_FALLBACK[section].some((key) => can(session, key));
}

export function firstAllowedWorkforceTrainingSection(session: PulseAuthSession | null): WorkforceTrainingSection {
  for (const section of WORKFORCE_TRAINING_SECTIONS) {
    if (canViewWorkforceTrainingSection(session, section)) return section;
  }
  return "overview";
}

export function canManageCertificationRegistry(session: PulseAuthSession | null): boolean {
  if (!session) return false;
  return (
    can(session, "standards.certifications.manage") ||
    can(session, "standards.training.certifications.view") ||
    can(session, "standards.certifications.view")
  );
}
