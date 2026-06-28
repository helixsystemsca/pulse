import { describe, expect, it } from "vitest";
import type { TrainingCourseDetail, TrainingStudyDueCard } from "@/lib/training/trainingPlatformApi";
import {
  computeSectionFlashcardStats,
  filterCardsForSection,
  HIDDEN_FLASHCARD_SECTION_SLUGS,
} from "@/lib/training/flashcard-sections";

function courseFixture(): TrainingCourseDetail {
  return {
    id: "course-1",
    company_id: "co-1",
    certification_id: null,
    procedure_id: null,
    slug: "capm",
    title: "CAPM Prep",
    description: null,
    course_kind: "certification",
    status: "published",
    completion_threshold_pct: 100,
    estimated_hours: null,
    tags: [],
    metadata: {},
    published_at: null,
    sections: [
      {
        id: "sec-a",
        company_id: "co-1",
        course_id: "course-1",
        parent_section_id: null,
        slug: "integration",
        title: "Integration",
        description: "Integration management",
        sort_order: 0,
        lessons: [
          {
            id: "lesson-holder",
            company_id: "co-1",
            course_id: "course-1",
            section_id: "sec-a",
            procedure_id: null,
            slug: "integration__flashcards",
            title: "Flashcards",
            summary: null,
            content_markdown: null,
            estimated_minutes: null,
            sort_order: 0,
            tags: [],
            metadata: {},
          },
          {
            id: "lesson-1",
            company_id: "co-1",
            course_id: "course-1",
            section_id: "sec-a",
            procedure_id: null,
            slug: "intro",
            title: "Intro",
            summary: null,
            content_markdown: null,
            estimated_minutes: null,
            sort_order: 1,
            tags: [],
            metadata: {},
          },
        ],
      },
      {
        id: "sec-empty",
        company_id: "co-1",
        course_id: "course-1",
        parent_section_id: null,
        slug: "empty",
        title: "Empty",
        description: null,
        sort_order: 1,
        lessons: [],
      },
      {
        id: "sec-hidden",
        company_id: "co-1",
        course_id: "course-1",
        parent_section_id: null,
        slug: [...HIDDEN_FLASHCARD_SECTION_SLUGS][0],
        title: "Hidden",
        description: null,
        sort_order: 2,
        lessons: [
          {
            id: "lesson-hidden",
            company_id: "co-1",
            course_id: "course-1",
            section_id: "sec-hidden",
            procedure_id: null,
            slug: "capm__flashcards",
            title: "Hidden cards",
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
}

function card(lessonId: string, id: string, reviewed: boolean): TrainingStudyDueCard {
  return {
    flashcard: {
      id,
      company_id: "co-1",
      course_id: "course-1",
      lesson_id: lessonId,
      card_type: "flashcard",
      prompt: `Q ${id}`,
      answer: `A ${id}`,
      explanation: null,
      difficulty: 3,
      tags: [],
      sort_order: 0,
    },
    review: reviewed
      ? {
          id: "rev-1",
          flashcard_id: id,
          ease_factor: 2.5,
          interval_days: 1,
          repetitions: 1,
          next_review_at: "2030-01-01T00:00:00Z",
        }
      : null,
  };
}

describe("computeSectionFlashcardStats", () => {
  it("hides empty and internal sections", () => {
    const course = courseFixture();
    const cards = [
      card("lesson-holder", "fc-1", true),
      card("lesson-1", "fc-2", false),
      card("lesson-hidden", "fc-3", false),
    ];
    const stats = computeSectionFlashcardStats(course, cards);
    expect(stats).toHaveLength(1);
    expect(stats[0]?.section.id).toBe("sec-a");
    expect(stats[0]?.cardCount).toBe(2);
    expect(stats[0]?.reviewedCount).toBe(1);
    expect(stats[0]?.progressPct).toBe(50);
  });
});

describe("filterCardsForSection", () => {
  it("returns only cards in the section lessons", () => {
    const course = courseFixture();
    const section = course.sections[0]!;
    const cards = [
      card("lesson-holder", "fc-1", false),
      card("lesson-1", "fc-2", false),
      card("lesson-hidden", "fc-3", false),
    ];
    const filtered = filterCardsForSection(cards, section);
    expect(filtered.map((c) => c.flashcard.id)).toEqual(["fc-1", "fc-2"]);
  });
});
