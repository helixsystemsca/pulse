import type {
  TrainingCourseDetail,
  TrainingSection,
  TrainingStudyDueCard,
} from "@/lib/training/trainingPlatformApi";

/** Synthetic section created for course-level flashcard imports. */
export const HIDDEN_FLASHCARD_SECTION_SLUGS = new Set(["__course_flashcards__"]);

export const FLASHCARD_HOLDER_LESSON_SUFFIX = "__flashcards";

export function isFlashcardHolderLesson(slug: string): boolean {
  return slug.endsWith(FLASHCARD_HOLDER_LESSON_SUFFIX);
}

export function lessonIdsForSection(section: TrainingSection): Set<string> {
  return new Set(section.lessons.map((lesson) => lesson.id));
}

export function buildLessonToSectionIdMap(course: TrainingCourseDetail): Map<string, string> {
  const map = new Map<string, string>();
  for (const section of course.sections) {
    for (const lesson of section.lessons) {
      map.set(lesson.id, section.id);
    }
  }
  return map;
}

export type SectionFlashcardStats = {
  section: TrainingSection;
  cardCount: number;
  reviewedCount: number;
  progressPct: number;
};

export function computeSectionFlashcardStats(
  course: TrainingCourseDetail,
  cards: TrainingStudyDueCard[],
): SectionFlashcardStats[] {
  const lessonToSection = buildLessonToSectionIdMap(course);
  const buckets = new Map<string, { total: number; reviewed: number }>();

  for (const section of course.sections) {
    if (HIDDEN_FLASHCARD_SECTION_SLUGS.has(section.slug)) continue;
    buckets.set(section.id, { total: 0, reviewed: 0 });
  }

  for (const item of cards) {
    const lessonId = item.flashcard.lesson_id;
    if (!lessonId) continue;
    const sectionId = lessonToSection.get(lessonId);
    if (!sectionId) continue;
    const bucket = buckets.get(sectionId);
    if (!bucket) continue;
    bucket.total += 1;
    if (item.review != null) bucket.reviewed += 1;
  }

  const stats: SectionFlashcardStats[] = [];
  for (const section of course.sections) {
    if (HIDDEN_FLASHCARD_SECTION_SLUGS.has(section.slug)) continue;
    const bucket = buckets.get(section.id) ?? { total: 0, reviewed: 0 };
    if (bucket.total === 0) continue;
    const progressPct =
      bucket.total > 0 ? Math.round((bucket.reviewed / bucket.total) * 100) : 0;
    stats.push({
      section,
      cardCount: bucket.total,
      reviewedCount: bucket.reviewed,
      progressPct,
    });
  }

  return stats.sort((a, b) => a.section.sort_order - b.section.sort_order);
}

export function filterCardsForSection(
  cards: TrainingStudyDueCard[],
  section: TrainingSection,
): TrainingStudyDueCard[] {
  const lessonIds = lessonIdsForSection(section);
  return cards.filter(
    (item) => item.flashcard.lesson_id != null && lessonIds.has(item.flashcard.lesson_id),
  );
}

export function findSectionById(
  course: TrainingCourseDetail,
  sectionId: string,
): TrainingSection | undefined {
  return course.sections.find((section) => section.id === sectionId);
}
