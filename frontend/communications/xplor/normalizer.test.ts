import { describe, expect, it } from "vitest";
import {
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
    expect(normalizeDatesInText("Jun 24-Jun 24")).toBe("Jun 24");
    expect(normalizeTimesInText("9:00am-12:00pm")).toBe("9am-12pm");
  });

  it("normalizes money", () => {
    expect(normalizeMoneyInText("$0")).toBe("Free");
    expect(normalizeMoneyInText("$24/1")).toBe("$24");
  });

  it("strips location label", () => {
    expect(stripLocationLabel("Location: Pool Deck")).toBe("Pool Deck");
  });

  it("normalizes session line composite", () => {
    expect(normalizeSessionLine("Jul 06 9:00am Fee: $0")).toContain("Jul 6");
    expect(normalizeSessionLine("Jul 06 9:00am Fee: $0")).toContain("9am");
    expect(normalizeSessionLine("Jul 06 9:00am Fee: $0")).toContain("Free");
  });
});
