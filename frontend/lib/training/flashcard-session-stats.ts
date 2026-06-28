import type { TrainingReviewRating, TrainingStudyDueCard } from "@/lib/training/trainingPlatformApi";
import { isMasteredFlashcard } from "@/lib/training/flashcard-deck-filter";

export function isDueFlashcard(card: TrainingStudyDueCard, now: Date = new Date()): boolean {
  const review = card.review;
  if (!review) return true;
  if (!review.next_review_at) return true;
  return new Date(review.next_review_at) <= now;
}

export type StudySessionStats = {
  cardsRemaining: number;
  mastered: number;
  reviewDue: number;
  currentStreak: number;
  sessionAccuracy: number | null;
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

export function computeStudySessionStats(
  cards: TrainingStudyDueCard[],
  reviewedCount: number,
  sessionRatings: readonly TrainingReviewRating[],
): StudySessionStats {
  const now = new Date();
  return {
    cardsRemaining: Math.max(0, cards.length - reviewedCount),
    mastered: cards.filter((c) => isMasteredFlashcard(c, now)).length,
    reviewDue: cards.filter((c) => isDueFlashcard(c, now)).length,
    currentStreak: sessionStreakFromRatings(sessionRatings),
    sessionAccuracy: sessionAccuracyPct(sessionRatings),
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
