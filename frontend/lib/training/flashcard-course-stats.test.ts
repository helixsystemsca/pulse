import { describe, expect, it } from "vitest";
import type { TrainingStudyDueCard } from "@/lib/training/trainingPlatformApi";
import {
  computeCourseFlashcardStats,
  computeStudyStreakDays,
} from "@/lib/training/flashcard-course-stats";

function card(
  id: string,
  opts: {
    reviewed?: boolean;
    lastReviewedAt?: string;
    lastRating?: "again" | "good" | "easy";
    nextReviewAt?: string;
  } = {},
): TrainingStudyDueCard {
  const reviewed = opts.reviewed ?? opts.lastReviewedAt != null;
  return {
    flashcard: {
      id,
      company_id: "co-1",
      course_id: "course-1",
      lesson_id: "lesson-1",
      card_type: "flashcard",
      prompt: "Q",
      answer: "A",
      explanation: null,
      difficulty: 3,
      tags: [],
      sort_order: 0,
    },
    review: reviewed
      ? {
          id: `rev-${id}`,
          flashcard_id: id,
          ease_factor: 2.5,
          interval_days: 1,
          repetitions: 1,
          last_rating: opts.lastRating ?? "good",
          last_reviewed_at: opts.lastReviewedAt ?? "2026-06-27T12:00:00Z",
          next_review_at: opts.nextReviewAt ?? "2030-01-01T00:00:00Z",
        }
      : null,
  };
}

describe("computeStudyStreakDays", () => {
  it("returns 0 when no reviews exist", () => {
    expect(computeStudyStreakDays([], new Date("2026-06-27T18:00:00"))).toBe(0);
  });

  it("counts consecutive days through today", () => {
    const now = new Date(2026, 5, 27, 18, 0, 0);
    const cards = [
      card("a", { lastReviewedAt: new Date(2026, 5, 27, 10, 0, 0).toISOString() }),
      card("b", { lastReviewedAt: new Date(2026, 5, 26, 10, 0, 0).toISOString() }),
      card("c", { lastReviewedAt: new Date(2026, 5, 25, 10, 0, 0).toISOString() }),
    ];
    expect(computeStudyStreakDays(cards, now)).toBe(3);
  });

  it("allows streak through yesterday when today has no reviews", () => {
    const now = new Date(2026, 5, 27, 18, 0, 0);
    const cards = [
      card("a", { lastReviewedAt: new Date(2026, 5, 26, 10, 0, 0).toISOString() }),
      card("b", { lastReviewedAt: new Date(2026, 5, 25, 10, 0, 0).toISOString() }),
    ];
    expect(computeStudyStreakDays(cards, now)).toBe(2);
  });

  it("resets when a day is missed", () => {
    const now = new Date(2026, 5, 27, 18, 0, 0);
    const cards = [
      card("a", { lastReviewedAt: new Date(2026, 5, 27, 10, 0, 0).toISOString() }),
      card("b", { lastReviewedAt: new Date(2026, 5, 25, 10, 0, 0).toISOString() }),
    ];
    expect(computeStudyStreakDays(cards, now)).toBe(1);
  });
});

describe("computeCourseFlashcardStats", () => {
  it("aggregates course-level metrics from section stats", () => {
    const course = {
      id: "course-1",
      company_id: "co-1",
      certification_id: null,
      procedure_id: null,
      slug: "capm",
      title: "CAPM",
      description: null,
      course_kind: "certification" as const,
      status: "published" as const,
      completion_threshold_pct: 100,
      estimated_hours: null,
      tags: [],
      metadata: {},
      published_at: null,
      sections: [
        {
          id: "sec-1",
          company_id: "co-1",
          course_id: "course-1",
          parent_section_id: null,
          slug: "scope",
          title: "Scope",
          description: null,
          sort_order: 0,
          lessons: [
            {
              id: "lesson-1",
              company_id: "co-1",
              course_id: "course-1",
              section_id: "sec-1",
              procedure_id: null,
              slug: "scope__flashcards",
              title: "Flashcards",
              summary: null,
              content_markdown: null,
              estimated_minutes: null,
              sort_order: 0,
              tags: [],
              metadata: {},
            },
          ],
        },
      ],
    };

    const now = new Date(2026, 5, 27, 18, 0, 0);
    const cards = [
      card("fc-1", {
        lastReviewedAt: new Date(2026, 5, 27, 10, 0, 0).toISOString(),
        nextReviewAt: new Date(2026, 5, 27, 8, 0, 0).toISOString(),
      }),
      card("fc-2"),
    ];

    const stats = computeCourseFlashcardStats(course, cards, now);
    expect(stats.totalCards).toBe(2);
    expect(stats.cardsLearned).toBe(1);
    expect(stats.cardsDueToday).toBe(2);
    expect(stats.cardsMastered).toBe(0);
    expect(stats.overallProgressPct).toBe(50);
    expect(stats.studyStreakDays).toBe(1);
    expect(stats.sections).toHaveLength(1);
  });
});
