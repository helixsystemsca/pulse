import { isMasteredFlashcard } from "@/lib/training/flashcard-deck-filter";
import { isDueFlashcard } from "@/lib/training/flashcard-session-stats";
import {
  computeSectionFlashcardStats,
  type SectionFlashcardStats,
} from "@/lib/training/flashcard-sections";
import type {
  TrainingCourseDetail,
  TrainingStudyDueCard,
} from "@/lib/training/trainingPlatformApi";

export type CourseFlashcardStats = {
  totalCards: number;
  cardsLearned: number;
  cardsDueToday: number;
  cardsMastered: number;
  overallProgressPct: number;
  studyStreakDays: number;
  sections: SectionFlashcardStats[];
};

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Consecutive calendar days with at least one review, counting through today or yesterday. */
export function computeStudyStreakDays(
  cards: TrainingStudyDueCard[],
  now: Date = new Date(),
): number {
  const studyDays = new Set<string>();
  for (const item of cards) {
    const reviewedAt = item.review?.last_reviewed_at;
    if (reviewedAt) {
      studyDays.add(toLocalDateKey(new Date(reviewedAt)));
    }
  }
  if (studyDays.size === 0) return 0;

  const todayKey = toLocalDateKey(now);
  const yesterdayKey = toLocalDateKey(addLocalDays(now, -1));

  let cursor: Date;
  if (studyDays.has(todayKey)) {
    cursor = now;
  } else if (studyDays.has(yesterdayKey)) {
    cursor = addLocalDays(now, -1);
  } else {
    return 0;
  }

  let streak = 0;
  while (studyDays.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor = addLocalDays(cursor, -1);
  }
  return streak;
}

export function computeCourseFlashcardStats(
  course: TrainingCourseDetail,
  cards: TrainingStudyDueCard[],
  now: Date = new Date(),
): CourseFlashcardStats {
  const sections = computeSectionFlashcardStats(course, cards);
  const totalCards = sections.reduce((sum, row) => sum + row.cardCount, 0);
  const cardsLearned = cards.filter((item) => item.review != null).length;
  const cardsDueToday = cards.filter((item) => isDueFlashcard(item, now)).length;
  const cardsMastered = cards.filter((item) => isMasteredFlashcard(item, now)).length;
  const overallProgressPct =
    totalCards > 0 ? Math.round((cardsLearned / totalCards) * 100) : 0;

  return {
    totalCards,
    cardsLearned,
    cardsDueToday,
    cardsMastered,
    overallProgressPct,
    studyStreakDays: computeStudyStreakDays(cards, now),
    sections,
  };
}

export function isSectionComplete(stats: SectionFlashcardStats): boolean {
  return stats.cardCount > 0 && stats.progressPct >= 100;
}
