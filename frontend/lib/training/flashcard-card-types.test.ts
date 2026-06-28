import { describe, expect, it } from "vitest";
import {
  getBlankAnswer,
  getComparisonLeft,
  getMultipleChoiceChoices,
  getMultipleChoiceCorrectIndex,
  isFillBlankResponseCorrect,
  isMultipleChoiceResponseCorrect,
  isShuffledMultipleChoiceResponseCorrect,
  isTrueFalseResponseCorrect,
  multipleChoiceOptionLabel,
  parseTrueFalseAnswer,
  resolveStudyType,
  shuffleMultipleChoiceForSession,
} from "@/lib/training/flashcard-card-types";

describe("resolveStudyType", () => {
  it("normalizes legacy card_type values", () => {
    expect(resolveStudyType({ card_type: "multiple_choice" })).toBe("mcq");
    expect(resolveStudyType({ card_type: "true_false" })).toBe("tf");
    expect(resolveStudyType({ card_type: "flashcard" })).toBe("flashcard");
  });

  it("prefers study_type from API when present", () => {
    expect(resolveStudyType({ card_type: "multiple_choice", study_type: "mcq" })).toBe("mcq");
  });
});
describe("parseTrueFalseAnswer", () => {
  it("parses common true/false strings", () => {
    expect(parseTrueFalseAnswer("True")).toBe(true);
    expect(parseTrueFalseAnswer("False.")).toBe(false);
    expect(parseTrueFalseAnswer("false")).toBe(false);
  });
});

describe("isTrueFalseResponseCorrect", () => {
  it("compares user response to card answer", () => {
    expect(isTrueFalseResponseCorrect({ answer: "False." }, false)).toBe(true);
    expect(isTrueFalseResponseCorrect({ answer: "False." }, true)).toBe(false);
  });
});

describe("multiple choice helpers", () => {
  const card = {
    answer: "A temporary endeavor that creates a unique product, service, or result.",
    options: {
      choices: [
        "An ongoing operational activity",
        "A temporary endeavor that creates a unique product, service, or result",
        "A recurring business process",
      ],
      correct_index: 1,
    },
  };

  it("reads choices and correct index", () => {
    expect(getMultipleChoiceChoices(card)).toHaveLength(3);
    expect(getMultipleChoiceCorrectIndex(card)).toBe(1);
    expect(isMultipleChoiceResponseCorrect(card, 1)).toBe(true);
    expect(isMultipleChoiceResponseCorrect(card, 0)).toBe(false);
  });

  it("labels options A, B, C", () => {
    expect(multipleChoiceOptionLabel(0)).toBe("A");
    expect(multipleChoiceOptionLabel(2)).toBe("C");
  });

  it("shuffles display order while preserving correct mapping", () => {
    const shuffled = shuffleMultipleChoiceForSession(card);
    expect(shuffled.displayChoices).toHaveLength(3);
    expect(shuffled.displayChoices.sort()).toEqual(card.options.choices.sort());
    expect(
      isShuffledMultipleChoiceResponseCorrect(shuffled, shuffled.correctDisplayIndex),
    ).toBe(true);
  });
});

describe("fill blank helpers", () => {
  const card = {
    answer: "Project Charter",
    options: { blank_answer: "project charter" },
  };

  it("grades normalized answers", () => {
    expect(getBlankAnswer(card)).toBe("project charter");
    expect(isFillBlankResponseCorrect(card, "  Project   Charter ")).toBe(true);
    expect(isFillBlankResponseCorrect(card, "wrong")).toBe(false);
  });
});

describe("comparison helpers", () => {
  it("reads left and right columns", () => {
    expect(
      getComparisonLeft({
        options: { comparison_left: "Predictive", comparisonRight: "Adaptive" },
      }),
    ).toBe("Predictive");
  });
});