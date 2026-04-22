/**
 * IoT deployment planner (floor plan) — device placement, scale, coverage, gaps.
 * Kept separate from `BlueprintElement` to avoid conflating RF planning with CMMS device icons.
 */

export type DeviceType = "node" | "gateway" | "lteHub";

export interface Device {
  id: string;
  type: DeviceType;
  x: number;
  y: number;
  rangeMeters: number;
}

/** Left palette modes for placement / calibration. */
export type IotTool = "select" | "node" | "gateway" | "lteHub" | "setScale";

export const DEFAULT_DEVICE_RANGE_M: Record<DeviceType, number> = {
  node: 12,
  gateway: 28,
  lteHub: 35,
};

/** Aligned with blueprint: ~32px ≈ 1m when the user has not calibrated yet. */
export const IOT_DEFAULT_METERS_PER_PIXEL = 1 / 32;

export interface IotBlueprintOverlayState {
  devices: Device[];
  metersPerPixel: number | null;
  coverageEnabled: boolean;
}
