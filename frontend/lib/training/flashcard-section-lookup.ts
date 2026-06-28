import type { TrainingCourseDetail } from "@/lib/training/trainingPlatformApi";

/** Map lesson id → section title using existing course detail (no backend change). */
export function buildLessonSectionTitleMap(course: TrainingCourseDetail): Map<string, string> {
  const map = new Map<string, string>();
  for (const section of course.sections) {
    for (const lesson of section.lessons) {
      map.set(lesson.id, section.title);
    }
  }
  return map;
}

export function sectionTitleForFlashcard(
  lessonId: string | null | undefined,
  lookup: Map<string, string>,
  fallback: string,
): string {
  if (!lessonId) return fallback;
  return lookup.get(lessonId) ?? fallback;
}
