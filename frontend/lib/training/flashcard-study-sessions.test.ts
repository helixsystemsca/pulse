import { describe, expect, it } from "vitest";
import { formatSessionDuration } from "@/lib/training/flashcard-study-sessions";

describe("formatSessionDuration", () => {
  it("formats seconds only", () => {
    expect(formatSessionDuration(45)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatSessionDuration(125)).toBe("2m 5s");
  });

  it("returns dash when null", () => {
    expect(formatSessionDuration(null)).toBe("—");
  });
});
