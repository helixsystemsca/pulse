/**
 * Canonical Training domain routes (information architecture).
 * Legacy `/standards/training/*` and related paths redirect here.
 */
export const TRAINING_ROUTES = {
  root: "/training",
  overview: "/training/overview",
  learning: "/training/learning",
  learningMyLearning: "/training/learning/my-learning",
  learningAssign: "/training/learning/assign",
  learningBundles: "/training/learning/bundles",
  learningLibrary: "/training/learning/library",
  learningArchive: "/training/learning/archive",
  /** @deprecated use learningMyLearning */
  learningAssignments: "/training/learning/my-learning",
  /** @deprecated use learningLibrary */
  learningProcedures: "/training/learning/library",
  /** @deprecated use learningArchive */
  learningAcknowledgments: "/training/learning/archive",
  compliance: "/training/compliance",
  complianceMatrix: "/training/compliance/matrix",
  complianceWorkers: "/training/compliance/workers",
  complianceRegistry: "/training/compliance/registry",
  complianceQueues: "/training/compliance/queues",
} as const;

/** Map legacy workforce training section slugs → compliance tab routes. */
export const LEGACY_TRAINING_SECTION_REDIRECTS: Record<string, string> = {
  overview: TRAINING_ROUTES.overview,
  workers: TRAINING_ROUTES.complianceWorkers,
  certifications: TRAINING_ROUTES.complianceRegistry,
  compliance: TRAINING_ROUTES.complianceMatrix,
  expiring: TRAINING_ROUTES.complianceQueues,
};

export type TrainingLearningSectionSlug =
  | "my-learning"
  | "assign"
  | "bundles"
  | "library"
  | "archive"
  | "assignments"
  | "procedures"
  | "acknowledgments";

export function trainingLearningHref(section: TrainingLearningSectionSlug): string {
  const map: Record<TrainingLearningSectionSlug, string> = {
    "my-learning": TRAINING_ROUTES.learningMyLearning,
    assignments: TRAINING_ROUTES.learningMyLearning,
    assign: TRAINING_ROUTES.learningAssign,
    bundles: TRAINING_ROUTES.learningBundles,
    library: TRAINING_ROUTES.learningLibrary,
    procedures: TRAINING_ROUTES.learningLibrary,
    archive: TRAINING_ROUTES.learningArchive,
    acknowledgments: TRAINING_ROUTES.learningArchive,
  };
  return map[section] ?? TRAINING_ROUTES.learningMyLearning;
}

export function trainingComplianceHref(
  section: "matrix" | "workers" | "registry" | "queues",
): string {
  if (section === "matrix") return TRAINING_ROUTES.complianceMatrix;
  return `/training/compliance/${section}`;
}
