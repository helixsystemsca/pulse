import type { MeasurementUnit } from "@/modules/communications/advertising-mapper/types";

export const INCHES_PER_FOOT = 12;

export function inchesToFeet(inches: number): number {
  return inches / INCHES_PER_FOOT;
}

export function feetToInches(feet: number): number {
  return feet * INCHES_PER_FOOT;
}

export function squareFeetFromInches(widthInches: number, heightInches: number): number {
  return (widthInches * heightInches) / (INCHES_PER_FOOT * INCHES_PER_FOOT);
}

export function formatMeasurement(inches: number, unit: MeasurementUnit, digits = 1): string {
  if (unit === "in") {
    return `${inches.toFixed(digits)}"`;
  }
  return `${inchesToFeet(inches).toFixed(digits)}'`;
}

export function parseMeasurementInput(value: number, unit: MeasurementUnit): number {
  if (unit === "in") return Math.max(0, value);
  return feetToInches(Math.max(0, value));
}

export function measurementToDisplayValue(inches: number, unit: MeasurementUnit): number {
  if (unit === "in") return inches;
  return inchesToFeet(inches);
}
