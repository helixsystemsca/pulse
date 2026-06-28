import { describe, expect, it } from "vitest";
import {
  applyFlashcardStudySettings,
  flashcardFaceContent,
  isIncorrectFlashcard,
  isMasteredFlashcard,
  isNewFlashcard,
} from "@/lib/training/flashcard-deck-filter";
import { DEFAULT_FLASHCARD_STUDY_SETTINGS } from "@/lib/training/flashcard-study-settings";
import type { TrainingStudyDueCard } from "@/lib/training/trainingPlatformApi";

function card(
  id: string,
  review: TrainingStudyDueCard["review"],
): TrainingStudyDueCard {
  return {
    flashcard: {
      id,
      company_id: "co",
      course_id: "c1",
      lesson_id: "l1",
      card_type: "flashcard",
      prompt: `Q-${id}`,
      answer: `A-${id}`,
      explanation: null,
      difficulty: 3,
      tags: [],
      sort_order: 0,
    },
    review,
  };
}

describe("flashcard deck filters", () => {
  const future = "2099-01-01T00:00:00Z";
  const past = "2020-01-01T00:00:00Z";

  it("detects new, incorrect, and mastered cards", () => {
    expect(isNewFlashcard(card("1", null))).toBe(true);
    expect(isIncorrectFlashcard(card("2", {
      id: "r", flashcard_id: "2", ease_factor: 2.5, interval_days: 0, repetitions: 0,
      last_rating: "again", next_review_at: past, last_reviewed_at: past,
    }))).toBe(true);
    expect(isMasteredFlashcard(card("3", {
      id: "r", flashcard_id: "3", ease_factor: 2.5, interval_days: 3, repetitions: 2,
      last_rating: "good", next_review_at: future, last_reviewed_at: past,
    }))).toBe(true);
  });

  it("filters deck by study settings", () => {
    const deck = [
      card("new", null),
      card("bad", {
        id: "r1", flashcard_id: "bad", ease_factor: 2.5, interval_days: 0, repetitions: 0,
        last_rating: "again", next_review_at: past, last_reviewed_at: past,
      }),
      card("done", {
        id: "r2", flashcard_id: "done", ease_factor: 2.5, interval_days: 4, repetitions: 2,
        last_rating: "good", next_review_at: future, last_reviewed_at: past,
      }),
    ];

    const newOnly = applyFlashcardStudySettings(deck, {
      ...DEFAULT_FLASHCARD_STUDY_SETTINGS,
      studyNewCardsOnly: true,
    });
    expect(newOnly.map((c) => c.flashcard.id)).toEqual(["new"]);

    const incorrectOnly = applyFlashcardStudySettings(deck, {
      ...DEFAULT_FLASHCARD_STUDY_SETTINGS,
      studyIncorrectCardsOnly: true,
    });
    expect(incorrectOnly.map((c) => c.flashcard.id)).toEqual(["bad"]);

    const hideMastered = applyFlashcardStudySettings(deck, {
      ...DEFAULT_FLASHCARD_STUDY_SETTINGS,
      hideMasteredCards: true,
    });
    expect(hideMastered.map((c) => c.flashcard.id)).toEqual(["new", "bad"]);
  });

  it("reverses question and answer faces", () => {
    const faces = flashcardFaceContent(
      { prompt: "Question?", answer: "Answer." } as TrainingStudyDueCard["flashcard"],
      { ...DEFAULT_FLASHCARD_STUDY_SETTINGS, reverseQuestionAnswer: true },
    );
    expect(faces.frontText).toBe("Answer.");
    expect(faces.backText).toBe("Question?");
  });
});
