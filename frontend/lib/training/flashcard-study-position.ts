/** Client-only resume position for flashcard study (no backend). */

const KEY_PREFIX = "helix.training.flashcards.position.";

export type FlashcardStudyPosition = {
  flashcardId: string;
  index: number;
};

export function flashcardStudyPositionKey(courseId: string): string {
  return `${KEY_PREFIX}${courseId}`;
}

export function readFlashcardStudyPosition(courseId: string): FlashcardStudyPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(flashcardStudyPositionKey(courseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FlashcardStudyPosition;
    if (typeof parsed.flashcardId !== "string" || typeof parsed.index !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeFlashcardStudyPosition(
  courseId: string,
  position: FlashcardStudyPosition,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(flashcardStudyPositionKey(courseId), JSON.stringify(position));
  } catch {
    /* quota / private mode */
  }
}

export function resolveFlashcardStudyIndex(
  cardIds: readonly string[],
  saved: FlashcardStudyPosition | null,
): number {
  if (cardIds.length === 0) return 0;
  if (!saved) return 0;
  const byId = cardIds.indexOf(saved.flashcardId);
  if (byId >= 0) return byId;
  if (saved.index >= 0 && saved.index < cardIds.length) return saved.index;
  return 0;
}
