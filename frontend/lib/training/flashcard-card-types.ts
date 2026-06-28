import type { TrainingFlashcard } from "@/lib/training/trainingPlatformApi";

export type StudyCardType =
  | "flashcard"
  | "mcq"
  | "tf"
  | "scenario"
  | "comparison"
  | "fill_blank";

const STUDY_TYPE_ALIASES: Record<string, StudyCardType> = {
  flashcard: "flashcard",
  definition: "flashcard",
  recall: "flashcard",
  matching: "flashcard",
  ordering: "flashcard",
  multiple_choice: "mcq",
  mcq: "mcq",
  true_false: "tf",
  tf: "tf",
  scenario: "scenario",
  comparison: "comparison",
  fill_blank: "fill_blank",
};

export function resolveStudyType(
  card: Pick<TrainingFlashcard, "card_type" | "study_type">,
): StudyCardType {
  const fromApi = card.study_type?.trim().toLowerCase();
  if (fromApi && fromApi in STUDY_TYPE_ALIASES) {
    return STUDY_TYPE_ALIASES[fromApi]!;
  }
  const raw = (card.card_type || "flashcard").trim().toLowerCase();
  return STUDY_TYPE_ALIASES[raw] ?? "flashcard";
}

export const STUDY_TYPE_LABELS: Record<StudyCardType, string> = {
  flashcard: "Flashcard",
  mcq: "Multiple choice",
  tf: "True or false",
  scenario: "Scenario",
  comparison: "Comparison",
  fill_blank: "Fill in the blank",
};

export function studyTypeLabel(card: Pick<TrainingFlashcard, "card_type" | "study_type">): string {
  return STUDY_TYPE_LABELS[resolveStudyType(card)];
}

export function isTrueFalseCard(card: Pick<TrainingFlashcard, "card_type" | "study_type">): boolean {
  return resolveStudyType(card) === "tf";
}

export function isMultipleChoiceCard(card: Pick<TrainingFlashcard, "card_type" | "study_type">): boolean {
  return resolveStudyType(card) === "mcq";
}

export function isFillBlankCard(card: Pick<TrainingFlashcard, "card_type" | "study_type">): boolean {
  return resolveStudyType(card) === "fill_blank";
}

export function isComparisonCard(card: Pick<TrainingFlashcard, "card_type" | "study_type">): boolean {
  return resolveStudyType(card) === "comparison";
}

export function isScenarioCard(card: Pick<TrainingFlashcard, "card_type" | "study_type">): boolean {
  return resolveStudyType(card) === "scenario";
}

/** Cards answered with tap / input instead of flip + confidence rating. */
export function isInteractiveStudyCard(card: Pick<TrainingFlashcard, "card_type" | "study_type">): boolean {
  const studyType = resolveStudyType(card);
  return studyType === "mcq" || studyType === "tf" || studyType === "fill_blank";
}

export function getCardHint(card: Pick<TrainingFlashcard, "options">): string | null {
  const hint = card.options?.hint;
  return typeof hint === "string" && hint.trim() ? hint.trim() : null;
}

/** Parse importer answers like "True", "False.", "true", etc. */
export function parseTrueFalseAnswer(answer: string): boolean {
  const normalized = answer.trim().toLowerCase().replace(/[.!?]+$/, "");
  if (normalized === "true" || normalized === "t" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "f" || normalized === "no") return false;
  return normalized.startsWith("true");
}

export function getTrueFalseStatement(
  card: Pick<TrainingFlashcard, "prompt" | "options">,
): string {
  const statement = card.options?.statement;
  if (typeof statement === "string" && statement.trim()) return statement.trim();
  return card.prompt;
}

export function getTrueFalseCorrectValue(
  card: Pick<TrainingFlashcard, "answer" | "options">,
): boolean {
  const isTrue = card.options?.is_true;
  if (typeof isTrue === "boolean") return isTrue;
  return parseTrueFalseAnswer(card.answer);
}

export function isTrueFalseResponseCorrect(
  card: Pick<TrainingFlashcard, "answer" | "options">,
  response: boolean,
): boolean {
  return response === getTrueFalseCorrectValue(card);
}

function normalizeChoiceText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeAnswerText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getMultipleChoiceChoices(card: Pick<TrainingFlashcard, "options" | "answer">): string[] {
  const raw = card.options?.choices;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((choice) => String(choice).trim()).filter(Boolean);
  }
  return card.answer?.trim() ? [card.answer.trim()] : [];
}

export function getMultipleChoiceCorrectIndex(
  card: Pick<TrainingFlashcard, "options" | "answer">,
): number {
  const choices = getMultipleChoiceChoices(card);
  if (choices.length === 0) return 0;

  const correctIndex = card.options?.correct_index ?? card.options?.correctAnswer;
  if (
    typeof correctIndex === "number" &&
    Number.isInteger(correctIndex) &&
    correctIndex >= 0 &&
    correctIndex < choices.length
  ) {
    return correctIndex;
  }

  const target = normalizeChoiceText(card.answer);
  const byAnswer = choices.findIndex((choice) => normalizeChoiceText(choice) === target);
  return byAnswer >= 0 ? byAnswer : 0;
}

export type ShuffledMultipleChoice = {
  displayChoices: string[];
  /** Maps display index → original choice index. */
  displayToOriginal: number[];
  correctDisplayIndex: number;
};

/** Randomize MCQ option order once per study session (per card visit). */
export function shuffleMultipleChoiceForSession(
  card: Pick<TrainingFlashcard, "options" | "answer">,
): ShuffledMultipleChoice {
  const choices = getMultipleChoiceChoices(card);
  const correctOriginal = getMultipleChoiceCorrectIndex(card);
  const indices = choices.map((_, i) => i);

  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }

  const displayChoices = indices.map((i) => choices[i]!);
  const correctDisplayIndex = indices.indexOf(correctOriginal);

  return {
    displayChoices,
    displayToOriginal: indices,
    correctDisplayIndex: correctDisplayIndex >= 0 ? correctDisplayIndex : 0,
  };
}

export function isMultipleChoiceResponseCorrect(
  card: Pick<TrainingFlashcard, "options" | "answer">,
  selectedIndex: number,
): boolean {
  if (selectedIndex < 0) return false;
  return selectedIndex === getMultipleChoiceCorrectIndex(card);
}

export function isShuffledMultipleChoiceResponseCorrect(
  shuffled: ShuffledMultipleChoice,
  selectedDisplayIndex: number,
): boolean {
  if (selectedDisplayIndex < 0) return false;
  return selectedDisplayIndex === shuffled.correctDisplayIndex;
}

export function getBlankAnswer(card: Pick<TrainingFlashcard, "answer" | "options">): string {
  const blank = card.options?.blank_answer ?? card.options?.blankAnswer;
  if (typeof blank === "string" && blank.trim()) return blank.trim();
  return card.answer?.trim() ?? "";
}

export function isFillBlankResponseCorrect(
  card: Pick<TrainingFlashcard, "answer" | "options">,
  response: string,
): boolean {
  const expected = getBlankAnswer(card);
  if (!expected) return false;
  return normalizeAnswerText(response) === normalizeAnswerText(expected);
}

export function getComparisonLeft(card: Pick<TrainingFlashcard, "options">): string {
  const left = card.options?.comparison_left ?? card.options?.comparisonLeft;
  return typeof left === "string" ? left.trim() : "";
}

export function getComparisonRight(card: Pick<TrainingFlashcard, "options">): string {
  const right = card.options?.comparison_right ?? card.options?.comparisonRight;
  return typeof right === "string" ? right.trim() : "";
}

export function multipleChoiceOptionLabel(index: number): string {
  return String.fromCharCode(65 + index);
}
