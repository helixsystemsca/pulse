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
  learningCourses: "/training/learning/courses",
  learningStudy: "/training/learning/study",
  learningPaths: "/training/learning/paths",
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
  /** Flashcards milestone — primary Training entry. */
  flashcards: "/training/flashcards",
} as const;

/** Sub-views under Training → Compliance → Workforce. */
export type WorkforceQualificationPanel = "people" | "certifications" | "queues";

const WORKFORCE_PANEL_QUERY: Record<Exclude<WorkforceQualificationPanel, "people">, string> = {
  certifications: "certifications",
  queues: "queues",
};

/** Map legacy workforce training section slugs → compliance tab routes. */
export const LEGACY_TRAINING_SECTION_REDIRECTS: Record<string, string> = {
  overview: TRAINING_ROUTES.overview,
  workers: TRAINING_ROUTES.complianceWorkers,
  certifications: trainingComplianceWorkersHref("certifications"),
  compliance: TRAINING_ROUTES.complianceMatrix,
  expiring: trainingComplianceWorkersHref("queues"),
};

export function workforcePanelFromComplianceSection(section: string): WorkforceQualificationPanel {
  if (section === "registry") return "certifications";
  if (section === "queues") return "queues";
  return "people";
}

export function trainingComplianceWorkersHref(panel: WorkforceQualificationPanel = "people"): string {
  if (panel === "people") return TRAINING_ROUTES.complianceWorkers;
  return `${TRAINING_ROUTES.complianceWorkers}?panel=${WORKFORCE_PANEL_QUERY[panel]}`;
}

export function workforcePanelFromSearchParams(
  panelParam: string | null | undefined,
): WorkforceQualificationPanel {
  if (panelParam === "certifications") return "certifications";
  if (panelParam === "queues") return "queues";
  return "people";
}

export type TrainingLearningSectionSlug =
  | "my-learning"
  | "assign"
  | "bundles"
  | "library"
  | "archive"
  | "courses"
  | "study"
  | "paths"
  | "assignments"
  | "procedures"
  | "acknowledgments";

export function trainingFlashcardStudyHref(courseId: string): string {
  return `${TRAINING_ROUTES.flashcards}/${encodeURIComponent(courseId)}`;
}

export function trainingCourseHref(courseId: string): string {
  return `${TRAINING_ROUTES.learningCourses}/${encodeURIComponent(courseId)}`;
}

export function trainingLessonHref(courseId: string, lessonId: string): string {
  return `${trainingCourseHref(courseId)}/lessons/${encodeURIComponent(lessonId)}`;
}

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
    courses: TRAINING_ROUTES.learningCourses,
    study: TRAINING_ROUTES.learningStudy,
    paths: TRAINING_ROUTES.learningPaths,
  };
  return map[section] ?? TRAINING_ROUTES.learningMyLearning;
}

export function trainingComplianceHref(
  section: "matrix" | "workers" | "registry" | "queues",
): string {
  if (section === "matrix") return TRAINING_ROUTES.complianceMatrix;
  if (section === "registry") return trainingComplianceWorkersHref("certifications");
  if (section === "queues") return trainingComplianceWorkersHref("queues");
  return TRAINING_ROUTES.complianceWorkers;
}
