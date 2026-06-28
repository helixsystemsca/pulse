import type { TrainingStudyDueCard } from "@/lib/training/trainingPlatformApi";
import type { FlashcardStudySettings } from "@/lib/training/flashcard-study-settings";

export function isNewFlashcard(card: TrainingStudyDueCard): boolean {
  return card.review == null;
}

export function isIncorrectFlashcard(card: TrainingStudyDueCard): boolean {
  const rating = card.review?.last_rating;
  return rating === "again" || rating === "unsure";
}

export function isMasteredFlashcard(card: TrainingStudyDueCard, now: Date = new Date()): boolean {
  const review = card.review;
  if (!review) return false;
  const rating = review.last_rating;
  if (rating !== "good" && rating !== "easy") return false;
  if (review.next_review_at) {
    return new Date(review.next_review_at) > now;
  }
  return review.repetitions >= 1;
}

function shuffleDeck<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function applyFlashcardStudySettings(
  cards: TrainingStudyDueCard[],
  settings: FlashcardStudySettings,
): TrainingStudyDueCard[] {
  let deck = [...cards];

  if (settings.hideMasteredCards) {
    deck = deck.filter((card) => !isMasteredFlashcard(card));
  }
  if (settings.studyNewCardsOnly) {
    deck = deck.filter(isNewFlashcard);
  }
  if (settings.studyIncorrectCardsOnly) {
    deck = deck.filter(isIncorrectFlashcard);
  }
  if (settings.shuffleCards) {
    deck = shuffleDeck(deck);
  }

  return deck;
}

export function flashcardFaceContent(
  card: TrainingStudyDueCard["flashcard"],
  settings: FlashcardStudySettings,
): { frontLabel: string; frontText: string; backLabel: string; backText: string } {
  if (settings.reverseQuestionAnswer) {
    return {
      frontLabel: "Answer",
      frontText: card.answer,
      backLabel: "Question",
      backText: card.prompt,
    };
  }
  return {
    frontLabel: "Question",
    frontText: card.prompt,
    backLabel: "Answer",
    backText: card.answer,
  };
}
