import type { AdSlotStatus } from "@/modules/communications/types";
import type { CalibrationReference, ConstraintRegion } from "@/modules/communications/advertising-mapper/geometry/types";

export type {
  AnchorPoint,
  CalibrationReference,
  ConstraintRegion,
  ConstraintType,
  GeometryLayer,
  GeometryLayerId,
  PlannerToolMode,
} from "@/modules/communications/advertising-mapper/geometry/types";

export type MeasurementUnit = "ft" | "in";

export type VisibilityTier = "standard" | "premium" | "marquee";

export type PriceTier = "tier_a" | "tier_b" | "tier_c";

/** Canonical inventory geometry — all dimensions stored in inches. */
export type InventoryBlock = {
  id: string;
  name: string;
  /** Inches from wall origin (top-left). */
  x: number;
  y: number;
  width_inches: number;
  height_inches: number;
  status: AdSlotStatus;
  sponsor?: string;
  zone?: string;
  visibilityTier?: VisibilityTier;
  priceTier?: PriceTier;
  inventoryId?: string;
  mountingType?: string;
  expiryDate?: string;
  assetUrl?: string;
};

export type WallBackdropKind = "arena" | "concourse" | "exterior" | "dasher" | "ribbon" | "neutral";

export type FacilityWallPlan = {
  id: string;
  name: string;
  width_inches: number;
  height_inches: number;
  backdropKind: WallBackdropKind;
  /** Optional photo URL (arena/concourse overlays). */
  backdropUrl?: string;
  /** Natural pixel size of uploaded backdrop (for aspect ratio). */
  backdropNaturalWidth?: number;
  backdropNaturalHeight?: number;
  gridSnapInches?: number;
  blocks: InventoryBlock[];
  /** Physical constraint regions — canonical polygon geometry in wall inches. */
  constraints: ConstraintRegion[];
  /** Future image calibration (two-point reference). */
  calibration?: CalibrationReference | null;
};

export type DimensionEditTarget = "width" | "height";
