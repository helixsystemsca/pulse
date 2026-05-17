import type { AdSlotStatus } from "@/modules/communications/types";

export type BlockVisualStyle = {
  fill: string;
  stroke: string;
  label: string;
  chipBg: string;
};

const STYLES: Record<AdSlotStatus, BlockVisualStyle> = {
  available: {
    fill: "rgba(16, 185, 129, 0.22)",
    stroke: "rgba(16, 185, 129, 0.85)",
    label: "AVAILABLE",
    chipBg: "#059669",
  },
  reserved: {
    fill: "rgba(245, 158, 11, 0.24)",
    stroke: "rgba(245, 158, 11, 0.9)",
    label: "RESERVED",
    chipBg: "#d97706",
  },
  occupied: {
    fill: "rgba(14, 165, 233, 0.22)",
    stroke: "rgba(14, 165, 233, 0.9)",
    label: "OCCUPIED",
    chipBg: "#0284c7",
  },
  expired: {
    fill: "rgba(100, 116, 139, 0.28)",
    stroke: "rgba(148, 163, 184, 0.75)",
    label: "EXPIRED",
    chipBg: "#64748b",
  },
};

export function blockStyleForStatus(status: AdSlotStatus): BlockVisualStyle {
  return STYLES[status];
}
