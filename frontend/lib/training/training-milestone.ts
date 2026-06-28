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

export function isTrainingRouteHiddenInMilestone(pathname: string): boolean {
  if (!TRAINING_MILESTONE_FLASHCARDS_ONLY) return false;
  const path = pathname.split("?")[0] ?? pathname;
  if (path === "/training" || path.startsWith("/training/flashcards")) return false;
  return TRAINING_MILESTONE_HIDDEN_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** Courses eligible for flashcard study (CAPM / certification packs). */
export function isFlashcardStudyCourse(course: { slug: string; title: string; course_kind: string }): boolean {
  const slug = course.slug.toLowerCase();
  const title = course.title.toLowerCase();
  if (slug.includes("capm") || title.includes("capm")) return true;
  if (course.course_kind === "certification") return true;
  return false;
}
