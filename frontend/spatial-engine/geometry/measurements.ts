export const INCHES_PER_FOOT = 12;

export type LinearDisplayUnit = "in" | "ft";

export function inchesToFeet(inches: number): number {
  return inches / INCHES_PER_FOOT;
}

export function feetToInches(feet: number): number {
  return feet * INCHES_PER_FOOT;
}

export function squareFeetFromRect(width: number, height: number, linearUnit: "in"): number {
  return (width * height) / (INCHES_PER_FOOT * INCHES_PER_FOOT);
}

export function formatLinearDistance(value: number, unit: LinearDisplayUnit, digits = 1): string {
  if (unit === "in") {
    return `${value.toFixed(digits)}"`;
  }
  return `${inchesToFeet(value).toFixed(digits)}'`;
}

export function parseLinearInput(value: number, unit: LinearDisplayUnit): number {
  if (unit === "in") return Math.max(0, value);
  return feetToInches(Math.max(0, value));
}

export function linearToDisplayValue(value: number, unit: LinearDisplayUnit): number {
  if (unit === "in") return value;
  return inchesToFeet(value);
}
