import { describe, expect, it } from "vitest";
import {
  formatAgeRange,
  formatInstructor,
  formatSessionDateRange,
  formatSessionPrice,
  hasInstructorName,
} from "./brochure-format";
import { collapseDuplicateDateRanges, normalizeDatesInText, normalizeTimesInText } from "./text-cleanup";

describe("brochure-format", () => {
  it("hides empty instructor", () => {
    expect(hasInstructorName("")).toBe(false);
    expect(hasInstructorName("   ")).toBe(false);
    expect(hasInstructorName("Instructor:")).toBe(false);
    expect(hasInstructorName("  Instructor:   ")).toBe(false);
    expect(hasInstructorName("Jane Doe")).toBe(true);
    expect(formatInstructor("Instructor: Jane Doe")).toBe("Jane Doe");
  });

  it("normalizes open-ended and ranged ages", () => {
    expect(formatAgeRange("60 yrs -")).toBe("60+ YEARS");
    expect(formatAgeRange("18 yrs -")).toBe("18+ YEARS");
    expect(formatAgeRange("16 - yrs")).toBe("16+ YEARS");
    expect(formatAgeRange("5 yrs - 8 yrs")).toBe("5–8 YEARS");
    expect(formatAgeRange("18+ yrs")).toBe("18+ YEARS");
    expect(formatAgeRange("3 - 5 yrs")).toBe("3–5 YEARS");
  });

  it("collapses duplicate and triple date ranges", () => {
    expect(normalizeDatesInText("Jul 06")).toBe("Jul 6");
    expect(normalizeDatesInText("Jun 24-Jun 24")).toBe("Jun 24");
    expect(collapseDuplicateDateRanges("Jun 24-Jun 24-Jun 24")).toBe("Jun 24");
    expect(formatSessionDateRange("Jun 24", "Jun 24")).toBe("Jun 24");
    expect(formatSessionDateRange("Jul 6", "Jul 10")).toBe("Jul 6–10");
  });

  it("normalizes times without stripping minutes", () => {
    expect(normalizeTimesInText("9:00am-12:00pm")).toBe("9am-12pm");
    expect(normalizeTimesInText("9:30am-12:30pm")).toBe("9:30am-12:30pm");
  });

  it("formats session price by session count", () => {
    expect(formatSessionPrice("$0", 1)).toBe("Free");
    expect(formatSessionPrice("$0/1", 1)).toBe("Free");
    expect(formatSessionPrice("$24/1", 1)).toBe("$24");
    expect(formatSessionPrice("$129/5", 5)).toBe("$129/5");
    expect(formatSessionPrice("$129/5", null)).toBe("$129/5");
  });
});
