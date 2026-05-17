import { describe, expect, it } from "vitest";
import {
  feetToInches,
  formatMeasurement,
  inchesToFeet,
  parseMeasurementInput,
  squareFeetFromInches,
} from "@/modules/communications/advertising-mapper/lib/measurements";

describe("measurements", () => {
  it("converts feet and inches", () => {
    expect(feetToInches(10)).toBe(120);
    expect(inchesToFeet(120)).toBe(10);
  });

  it("formats in ft and in modes", () => {
    expect(formatMeasurement(24, "ft")).toBe("2.0'");
    expect(formatMeasurement(24, "in")).toBe('24.0"');
  });

  it("parses user input back to inches", () => {
    expect(parseMeasurementInput(10, "ft")).toBe(120);
    expect(parseMeasurementInput(48, "in")).toBe(48);
  });

  it("computes square feet", () => {
    expect(squareFeetFromInches(120, 48)).toBe(40);
  });
});
