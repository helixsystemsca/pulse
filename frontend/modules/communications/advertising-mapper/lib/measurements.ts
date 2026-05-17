import type { MeasurementUnit } from "@/modules/communications/advertising-mapper/types";
import {
  feetToInches,
  formatLinearDistance,
  inchesToFeet,
  INCHES_PER_FOOT,
  linearToDisplayValue,
  parseLinearInput,
  squareFeetFromRect,
} from "@/spatial-engine/geometry/measurements";

export { INCHES_PER_FOOT, inchesToFeet, feetToInches };

export function squareFeetFromInches(widthInches: number, heightInches: number): number {
  return squareFeetFromRect(widthInches, heightInches, "in");
}

export function formatMeasurement(inches: number, unit: MeasurementUnit, digits = 1): string {
  return formatLinearDistance(inches, unit, digits);
}

export function parseMeasurementInput(value: number, unit: MeasurementUnit): number {
  return parseLinearInput(value, unit);
}

export function measurementToDisplayValue(inches: number, unit: MeasurementUnit): number {
  return linearToDisplayValue(inches, unit);
}
