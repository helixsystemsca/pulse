import { describe, expect, it } from "vitest";
import type { TrainingStudyDueCard } from "@/lib/training/trainingPlatformApi";
import {
  computeStudySessionStats,
  isDueFlashcard,
  sessionAccuracyPct,
  sessionStreakFromRatings,
} from "@/lib/training/flashcard-session-stats";

function card(review: TrainingStudyDueCard["review"]): TrainingStudyDueCard {
  return {
    flashcard: {
      id: "fc-1",
      company_id: "c",
      course_id: "course",
      lesson_id: "l",
      card_type: "flashcard",
      prompt: "Q",
      answer: "A",
      explanation: null,
      difficulty: 3,
      tags: [],
      sort_order: 0,
    },
    review,
  };
}

describe("flashcard session stats", () => {
  it("computes streak and accuracy", () => {
    expect(sessionStreakFromRatings(["again", "good", "easy", "good"])).toBe(3);
    expect(sessionAccuracyPct(["again", "good", "easy"])).toBe(67);
  });

  it("computes deck stats", () => {
    const future = "2099-01-01T00:00:00Z";
    const past = "2020-01-01T00:00:00Z";
    const deck = [
      card(null),
      card({
        id: "r1",
        flashcard_id: "fc-1",
        ease_factor: 2.5,
        interval_days: 3,
        repetitions: 2,
        last_rating: "good",
        next_review_at: future,
        last_reviewed_at: past,
      }),
      card({
        id: "r2",
        flashcard_id: "fc-1",
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        last_rating: "again",
        next_review_at: past,
        last_reviewed_at: past,
      }),
    ];
    const stats = computeStudySessionStats(deck, 1, ["good"]);
    expect(stats.cardsRemaining).toBe(2);
    expect(stats.mastered).toBe(1);
    expect(stats.reviewDue).toBe(2);
    expect(stats.currentStreak).toBe(1);
    expect(stats.sessionAccuracy).toBe(100);
  });

  it("detects due cards", () => {
    expect(isDueFlashcard(card(null))).toBe(true);
    expect(
      isDueFlashcard(
        card({
          id: "r",
          flashcard_id: "fc-1",
          ease_factor: 2.5,
          interval_days: 1,
          repetitions: 1,
          last_rating: "good",
          next_review_at: "2099-01-01T00:00:00Z",
          last_reviewed_at: null,
        }),
      ),
    ).toBe(false);
  });
});
