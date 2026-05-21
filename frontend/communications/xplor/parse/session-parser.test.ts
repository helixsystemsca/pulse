import { describe, expect, it } from "vitest";
import { parseSessionBlob, parseSessionLines, stripTagCorruption } from "./session-parser";

describe("stripTagCorruption", () => {
  it("removes duplicated pstyle OCR fragments", () => {
    const raw = "[pstyle:Eventdetail](pstyle:Eventdetail)M-F 9:00am-12:00pm Jul 06-Jul 10 $129/5 187651";
    expect(stripTagCorruption(raw)).toBe("M-F 9:00am-12:00pm Jul 06-Jul 10 $129/5 187651");
  });
});

describe("parseSessionBlob", () => {
  it("parses combined schedule OCR line", () => {
    const s = parseSessionBlob("M-F 9:00am-12:00pm Jul 06-Jul 10 $129/5 187651", { ageGroup: "6-9 yrs", index: 0 });
    expect(s.days).toMatch(/M-F/i);
    expect(s.time).toContain("9");
    expect(s.startDate).toContain("Jul");
    expect(s.price).toBe("$129/5");
    expect(s.sessionCount).toBe(5);
    expect(s.programCode).toBe("187651");
    expect(s.sessionLabel).toBe("Session A");
  });

  it("parses fee-only line", () => {
    const s = parseSessionBlob("Fee: $0", { index: 1 });
    expect(s.price).toBe("Free");
  });

  it("parses optional and compact prices", () => {
    const withSlash = parseSessionBlob("M-F 9am Jul 6 $8/9 123456", { index: 0 });
    expect(withSlash.price).toBe("$8/9");
    expect(withSlash.sessionCount).toBe(9);

    const plain = parseSessionBlob("M-F 9am Jul 6 $12 123457", { index: 0 });
    expect(plain.price).toBe("$12");

    const missing = parseSessionBlob("M-F 9am Jul 6 123458", { index: 0 });
    expect(missing.price).toBe("");
    expect(missing.warnings.some((w) => w.code === "missing_price")).toBe(true);
  });

  it("handles partial schedule with warning", () => {
    const s = parseSessionBlob("187651", { index: 0 });
    expect(s.programCode).toBe("187651");
    expect(s.warnings.some((w) => w.code === "session_empty" || w.code === "ocr_fragment")).toBe(true);
  });
});

describe("parseSessionLines", () => {
  it("parses multiple sessions per program", () => {
    const sessions = parseSessionLines(
      ["M-F 9am-12pm Jul 6–10 $100/4 111222", "Fee: Free"],
      "3 - 5 yrs",
    );
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.programCode).toBe("111222");
    expect(sessions[1]!.price).toBe("Free");
  });
});
