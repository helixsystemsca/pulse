import type { TrainingReviewRating, TrainingStudyDueCard } from "@/lib/training/trainingPlatformApi";
import { resolveStudyType } from "@/lib/training/flashcard-card-types";
import { isMasteredFlashcard } from "@/lib/training/flashcard-deck-filter";

export function isDueFlashcard(card: TrainingStudyDueCard, now: Date = new Date()): boolean {
  const review = card.review;
  if (!review) return true;
  if (!review.next_review_at) return true;
  return new Date(review.next_review_at) <= now;
}

export type SessionReviewEvent = {
  studyType: string;
  rating: TrainingReviewRating;
};

export type StudySessionStatsByCardType = {
  studyType: string;
  reviewsCount: number;
  correctCount: number;
  accuracyPct: number | null;
};

export type StudySessionStats = {
  cardsRemaining: number;
  mastered: number;
  reviewDue: number;
  currentStreak: number;
  sessionAccuracy: number | null;
  byCardType: StudySessionStatsByCardType[];
};

export function sessionStreakFromRatings(ratings: readonly TrainingReviewRating[]): number {
  let streak = 0;
  for (let i = ratings.length - 1; i >= 0; i -= 1) {
    const r = ratings[i];
    if (r === "good" || r === "easy") {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function sessionAccuracyPct(ratings: readonly TrainingReviewRating[]): number | null {
  if (ratings.length === 0) return null;
  const correct = ratings.filter((r) => r === "good" || r === "easy").length;
  return Math.round((correct / ratings.length) * 100);
}

function isCorrectRating(rating: TrainingReviewRating): boolean {
  return rating === "good" || rating === "easy";
}

export function aggregateSessionStatsByCardType(
  events: readonly SessionReviewEvent[],
): StudySessionStatsByCardType[] {
  const buckets = new Map<string, { total: number; correct: number }>();
  for (const event of events) {
    const bucket = buckets.get(event.studyType) ?? { total: 0, correct: 0 };
    bucket.total += 1;
    if (isCorrectRating(event.rating)) bucket.correct += 1;
    buckets.set(event.studyType, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([studyType, bucket]) => ({
      studyType,
      reviewsCount: bucket.total,
      correctCount: bucket.correct,
      accuracyPct: bucket.total > 0 ? Math.round((bucket.correct / bucket.total) * 100) : null,
    }));
}

export function computeStudySessionStats(
  cards: TrainingStudyDueCard[],
  reviewedCount: number,
  sessionEvents: readonly SessionReviewEvent[],
): StudySessionStats {
  const now = new Date();
  const ratings = sessionEvents.map((e) => e.rating);
  return {
    cardsRemaining: Math.max(0, cards.length - reviewedCount),
    mastered: cards.filter((c) => isMasteredFlashcard(c, now)).length,
    reviewDue: cards.filter((c) => isDueFlashcard(c, now)).length,
    currentStreak: sessionStreakFromRatings(ratings),
    sessionAccuracy: sessionAccuracyPct(ratings),
    byCardType: aggregateSessionStatsByCardType(sessionEvents),
  };
}

export function makeSessionReviewEvent(
  card: TrainingStudyDueCard,
  rating: TrainingReviewRating,
): SessionReviewEvent {
  return {
    studyType: resolveStudyType(card.flashcard),
    rating,
  };
}

export function mergeReviewAfterRating(
  card: TrainingStudyDueCard,
  rating: TrainingReviewRating,
  response: { next_review_at: string; interval_days: number },
): TrainingStudyDueCard {
  const prev = card.review;
  return {
    ...card,
    review: {
      id: prev?.id ?? `session-${card.flashcard.id}`,
      flashcard_id: card.flashcard.id,
      ease_factor: prev?.ease_factor ?? 2.5,
      interval_days: response.interval_days,
      repetitions: prev?.repetitions ?? (rating === "again" ? 0 : 1),
      last_rating: rating,
      next_review_at: response.next_review_at,
      last_reviewed_at: new Date().toISOString(),
    },
  };
}
