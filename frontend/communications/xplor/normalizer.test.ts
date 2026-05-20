import { describe, expect, it } from "vitest";
import {
  applyOcrPhraseFixes,
  normalizeAgeText,
  normalizeDatesInText,
  normalizeMoneyInText,
  normalizeSessionLine,
  normalizeTimesInText,
  stripLocationLabel,
} from "./normalizer";

describe("normalizer", () => {
  it("normalizes age edge case", () => {
    expect(normalizeAgeText("16 - yrs")).toBe("16 yrs+");
    expect(normalizeAgeText("3 - 5 yrs")).toBe("3 - 5 yrs");
  });

  it("normalizes dates and times", () => {
    expect(normalizeDatesInText("Jul 06")).toBe("Jul 6");
    expect(normalizeDatesInText("Jul 06-Jul 10")).toBe("Jul 6–10");
    expect(normalizeTimesInText("9:00am-12:00pm")).toBe("9am-12pm");
  });

  it("normalizes money", () => {
    expect(normalizeMoneyInText("$0")).toBe("Free");
    expect(normalizeMoneyInText("$24/1")).toBe("$24");
  });

  it("strips location label", () => {
    expect(stripLocationLabel("Location: Pool Deck")).toBe("Pool Deck");
  });

  it("fixes common OCR phrases", () => {
    expect(applyOcrPhraseFixes("One along for camp")).toBe("Come along for camp");
  });

  it("normalizes session line composite", () => {
    expect(normalizeSessionLine("Jul 06 9:00am Fee: $0")).toContain("Jul 6");
    expect(normalizeSessionLine("Jul 06 9:00am Fee: $0")).toContain("9am");
    expect(normalizeSessionLine("Jul 06 9:00am Fee: $0")).toContain("Free");
  });
});
