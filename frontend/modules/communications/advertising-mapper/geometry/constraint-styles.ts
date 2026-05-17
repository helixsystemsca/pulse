import type { ConstraintType } from "@/modules/communications/advertising-mapper/geometry/types";

export type ConstraintVisualStyle = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash?: number[];
  label: string;
};

export const CONSTRAINT_VISUAL_STYLES: Record<ConstraintType, ConstraintVisualStyle> = {
  blocked: {
    fill: "rgba(239, 68, 68, 0.28)",
    stroke: "rgba(220, 38, 38, 0.9)",
    strokeWidth: 1.5,
    label: "Blocked",
  },
  mountable: {
    fill: "rgba(34, 197, 94, 0.22)",
    stroke: "rgba(22, 163, 74, 0.85)",
    strokeWidth: 1.5,
    label: "Mountable",
  },
  restricted: {
    fill: "rgba(234, 179, 8, 0.2)",
    stroke: "rgba(202, 138, 4, 0.9)",
    strokeWidth: 1.5,
    dash: [6, 4],
    label: "Restricted",
  },
  premium_visibility: {
    fill: "rgba(56, 189, 248, 0.18)",
    stroke: "rgba(14, 165, 233, 0.85)",
    strokeWidth: 2,
    label: "Premium visibility",
  },
  curved_surface: {
    fill: "rgba(168, 85, 247, 0.15)",
    stroke: "rgba(147, 51, 234, 0.8)",
    strokeWidth: 1.5,
    dash: [4, 3],
    label: "Curved surface",
  },
  electrical_access: {
    fill: "rgba(251, 146, 60, 0.2)",
    stroke: "rgba(234, 88, 12, 0.85)",
    strokeWidth: 1.5,
    label: "Electrical access",
  },
};

export function styleForConstraintType(type: ConstraintType): ConstraintVisualStyle {
  return CONSTRAINT_VISUAL_STYLES[type];
}

export const CONSTRAINT_TYPE_OPTIONS: { value: ConstraintType; label: string }[] = [
  { value: "blocked", label: "Blocked" },
  { value: "mountable", label: "Mountable" },
  { value: "restricted", label: "Restricted" },
  { value: "premium_visibility", label: "Premium visibility" },
  { value: "curved_surface", label: "Curved surface" },
  { value: "electrical_access", label: "Electrical access" },
];
