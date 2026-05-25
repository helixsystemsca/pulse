import { can } from "@/lib/rbac/session-access";
import type { PulseAuthSession } from "@/lib/pulse-session";
import {
  canViewWorkforceTrainingSection,
  type WorkforceTrainingSection,
} from "@/lib/standards/workforce-training-access";

export const TRAINING_LEARNING_SECTIONS = ["assignments", "procedures", "acknowledgments"] as const;
export type TrainingLearningSection = (typeof TRAINING_LEARNING_SECTIONS)[number];

export const TRAINING_COMPLIANCE_SECTIONS = ["matrix", "workers", "registry", "queues"] as const;
export type TrainingComplianceSection = (typeof TRAINING_COMPLIANCE_SECTIONS)[number];

export function isTrainingLearningSection(value: string): value is TrainingLearningSection {
  return (TRAINING_LEARNING_SECTIONS as readonly string[]).includes(value);
}

export function isTrainingComplianceSection(value: string): value is TrainingComplianceSection {
  return (TRAINING_COMPLIANCE_SECTIONS as readonly string[]).includes(value);
}

const LEARNING_TO_LEGACY: Record<TrainingLearningSection, WorkforceTrainingSection | null> = {
  assignments: "overview",
  procedures: "overview",
  acknowledgments: "compliance",
};

const COMPLIANCE_TO_LEGACY: Record<TrainingComplianceSection, WorkforceTrainingSection> = {
  matrix: "compliance",
  workers: "workers",
  registry: "certifications",
  queues: "expiring",
};

export function canViewTrainingLearningSection(
  session: PulseAuthSession | null,
  section: TrainingLearningSection,
): boolean {
  if (!session) return false;
  if (section === "assignments") {
    return can(session, "procedures.view");
  }
  if (section === "procedures") {
    return can(session, "procedures.view");
  }
  const legacy = LEARNING_TO_LEGACY[section];
  return legacy ? canViewWorkforceTrainingSection(session, legacy) : false;
}

export function canViewTrainingComplianceSection(
  session: PulseAuthSession | null,
  section: TrainingComplianceSection,
): boolean {
  return canViewWorkforceTrainingSection(session, COMPLIANCE_TO_LEGACY[section]);
}

export function firstAllowedTrainingLearningSection(session: PulseAuthSession | null): TrainingLearningSection {
  for (const s of TRAINING_LEARNING_SECTIONS) {
    if (canViewTrainingLearningSection(session, s)) return s;
  }
  return "assignments";
}

export function firstAllowedTrainingComplianceSection(
  session: PulseAuthSession | null,
): TrainingComplianceSection {
  for (const s of TRAINING_COMPLIANCE_SECTIONS) {
    if (canViewTrainingComplianceSection(session, s)) return s;
  }
  return "matrix";
}
