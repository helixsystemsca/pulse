import { describe, expect, it } from "vitest";
import { isFailResult, resultFromInspectionValue } from "@/lib/inspectionsService";

describe("inspection fail mapping", () => {
  it("treats fail synonyms as failed", () => {
    expect(isFailResult("fail")).toBe(true);
    expect(isFailResult("NO")).toBe(true);
    expect(isFailResult("pass")).toBe(false);
  });

  it("maps checklist values", () => {
    expect(resultFromInspectionValue("checkbox", false).result).toBe("fail");
    expect(resultFromInspectionValue("checkbox", true).result).toBe("pass");
    expect(resultFromInspectionValue("yes_no", "no").result).toBe("fail");
    expect(resultFromInspectionValue("yes_no", "yes").result).toBe("pass");
  });
});
