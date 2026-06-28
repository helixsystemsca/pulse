import { describe, expect, it } from "vitest";
import { resolveFlashcardStudyIndex } from "@/lib/training/flashcard-study-position";

describe("resolveFlashcardStudyIndex", () => {
  const ids = ["a", "b", "c"];

  it("returns 0 when nothing saved", () => {
    expect(resolveFlashcardStudyIndex(ids, null)).toBe(0);
  });

  it("restores by flashcard id when deck order changes", () => {
    expect(resolveFlashcardStudyIndex(ids, { flashcardId: "c", index: 0 })).toBe(2);
  });

  it("falls back to saved index when id missing", () => {
    expect(resolveFlashcardStudyIndex(ids, { flashcardId: "z", index: 1 })).toBe(1);
  });
});
