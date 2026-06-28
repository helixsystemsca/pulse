import { can } from "@/lib/rbac/session-access";
import type { PulseAuthSession } from "@/lib/pulse-session";
import {
  trainingSupervisionAccess,
  trainingTeamMatrixAccess,
  complianceManagerFlagAllowed,
} from "@/lib/pulse-roles";
import {
  canViewWorkforceTrainingSection,
  type WorkforceTrainingSection,
} from "@/lib/standards/workforce-training-access";

/** Learning hub sections (URL slugs). Legacy slugs normalize via {@link normalizeLearningSection}. */
export const TRAINING_LEARNING_SECTIONS = [
  "my-learning",
  "courses",
  "study",
  "paths",
  "assign",
  "bundles",
  "library",
  "archive",
] as const;

export type TrainingLearningSection = (typeof TRAINING_LEARNING_SECTIONS)[number];

export const TRAINING_COMPLIANCE_SECTIONS = ["matrix", "workers", "registry", "queues"] as const;
export type TrainingComplianceSection = (typeof TRAINING_COMPLIANCE_SECTIONS)[number];

const LEGACY_LEARNING_ALIASES: Record<string, TrainingLearningSection> = {
  assignments: "my-learning",
  procedures: "library",
  acknowledgments: "archive",
};

export function normalizeLearningSection(value: string): string {
  return LEGACY_LEARNING_ALIASES[value] ?? value;
}

export function isTrainingLearningSection(value: string): value is TrainingLearningSection {
  const n = normalizeLearningSection(value);
  return (TRAINING_LEARNING_SECTIONS as readonly string[]).includes(n);
}

export function isTrainingComplianceSection(value: string): value is TrainingComplianceSection {
  return (TRAINING_COMPLIANCE_SECTIONS as readonly string[]).includes(value);
}

const LEARNING_TO_LEGACY: Record<TrainingLearningSection, WorkforceTrainingSection | null> = {
  "my-learning": "overview",
  courses: "overview",
  study: "overview",
  paths: "overview",
  assign: "overview",
  bundles: "overview",
  library: "overview",
  archive: "compliance",
};

const COMPLIANCE_TO_LEGACY: Record<TrainingComplianceSection, WorkforceTrainingSection> = {
  matrix: "compliance",
  workers: "workers",
  registry: "certifications",
  queues: "expiring",
};

/** Org-wide compliance / archive — company admin, management, supervision only. */
export function canViewTrainingSupervisionViews(session: PulseAuthSession | null): boolean {
  return trainingSupervisionAccess(session);
}

/** Signed-in worker's own learning hub (scoped to `session.sub` in views). */
export function canViewMyLearning(session: PulseAuthSession | null): boolean {
  if (!session?.sub) return false;
  return can(session, "procedures.view");
}

export function canAssignLearning(session: PulseAuthSession | null): boolean {
  return trainingTeamMatrixAccess(session);
}

export function canManageLearningBundles(session: PulseAuthSession | null): boolean {
  return complianceManagerFlagAllowed(session) || trainingTeamMatrixAccess(session);
}

export function canViewTrainingLearningSection(
  session: PulseAuthSession | null,
  section: TrainingLearningSection,
): boolean {
  if (!session) return false;
  if (section === "my-learning") return canViewMyLearning(session);
  if (section === "courses" || section === "study" || section === "paths") return canViewMyLearning(session);
  if (section === "archive") return canViewTrainingSupervisionViews(session);
  if (section === "assign") return canAssignLearning(session);
  if (section === "bundles") return canManageLearningBundles(session);
  if (section === "library") return can(session, "procedures.view");
  const legacy = LEARNING_TO_LEGACY[section];
  return legacy ? canViewWorkforceTrainingSection(session, legacy) : false;
}

export function canViewTrainingComplianceSection(
  session: PulseAuthSession | null,
  _section: TrainingComplianceSection,
): boolean {
  return canViewTrainingSupervisionViews(session);
}

export function canViewAnyTrainingCompliance(session: PulseAuthSession | null): boolean {
  return canViewTrainingSupervisionViews(session);
}

export function firstAllowedTrainingLearningSection(session: PulseAuthSession | null): TrainingLearningSection {
  for (const s of TRAINING_LEARNING_SECTIONS) {
    if (canViewTrainingLearningSection(session, s)) return s;
  }
  return "my-learning";
}

export function firstAllowedTrainingComplianceSection(
  session: PulseAuthSession | null,
): TrainingComplianceSection | null {
  if (!canViewAnyTrainingCompliance(session)) return null;
  for (const s of TRAINING_COMPLIANCE_SECTIONS) {
    if (canViewTrainingComplianceSection(session, s)) return s;
  }
  return "matrix";
}
