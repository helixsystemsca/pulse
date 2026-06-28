/**
 * Training module milestone flags — toggle to re-enable full Training IA later.
 * Backend routes, models, and dormant UI components remain in the codebase.
 */
export const TRAINING_MILESTONE_FLASHCARDS_ONLY = true;

/** Sidebar registry keys visible during the flashcards-only milestone. */
export const TRAINING_MILESTONE_VISIBLE_NAV_KEYS = new Set(["training_root", "training_flashcards"]);

/** Route prefixes redirected to Flashcards home when milestone is active. */
export const TRAINING_MILESTONE_HIDDEN_ROUTE_PREFIXES = [
  "/training/overview",
  "/training/learning",
  "/training/compliance",
] as const;

/** Certification / program names recognized for flashcard study decks. */
export const FLASHCARD_CERTIFICATION_HINTS = [
  "capm",
  "camp",
  "fmp",
  "six sigma",
  "power bi",
  "pmp",
  "pmi",
  "lean",
  "itil",
] as const;

export function isTrainingRouteHiddenInMilestone(pathname: string): boolean {
  if (!TRAINING_MILESTONE_FLASHCARDS_ONLY) return false;
  const path = pathname.split("?")[0] ?? pathname;
  if (path === "/training" || path.startsWith("/training/flashcards")) return false;
  return TRAINING_MILESTONE_HIDDEN_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

type FlashcardCourseLike = {
  slug: string;
  title: string;
  course_kind: string;
  status?: string;
  tags?: string[];
  certification_slug?: string | null;
  certification_title?: string | null;
};

/** Courses eligible for flashcard study (certification decks). */
export function isFlashcardStudyCourse(course: FlashcardCourseLike): boolean {
  if (course.status === "archived") return false;
  if (course.course_kind === "certification") return true;
  if (course.certification_slug || course.certification_title) return true;

  const hay = [course.slug, course.title, ...(course.tags ?? [])].join(" ").toLowerCase();
  return FLASHCARD_CERTIFICATION_HINTS.some((hint) => hay.includes(hint));
}

export function flashcardCertificationLabel(course: FlashcardCourseLike): string {
  if (course.certification_title) return course.certification_title;
  if (course.certification_slug) {
    return course.certification_slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const hay = `${course.slug} ${course.title}`.toLowerCase();
  const match = FLASHCARD_CERTIFICATION_HINTS.find((hint) => hay.includes(hint));
  if (match) return match.replace(/\b\w/g, (c) => c.toUpperCase());
  return course.course_kind === "certification" ? "Certification" : course.course_kind;
}
