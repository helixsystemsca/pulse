/**
 * Canonical Training domain routes (information architecture).
 * Legacy `/standards/training/*` and related paths redirect here.
 */
export const TRAINING_ROUTES = {
  root: "/training",
  overview: "/training/overview",
  learning: "/training/learning",
  learningAssignments: "/training/learning/assignments",
  learningProcedures: "/training/learning/procedures",
  learningAcknowledgments: "/training/learning/acknowledgments",
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

export function trainingLearningHref(section: "assignments" | "procedures" | "acknowledgments"): string {
  if (section === "assignments") return TRAINING_ROUTES.learningAssignments;
  return `/training/learning/${section}`;
}

export function trainingComplianceHref(
  section: "matrix" | "workers" | "registry" | "queues",
): string {
  if (section === "matrix") return TRAINING_ROUTES.complianceMatrix;
  return `/training/compliance/${section}`;
}
