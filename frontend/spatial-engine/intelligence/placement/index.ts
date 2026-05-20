export type {
  SmartSnapOptions,
  SnapTarget,
  SnapTargetKind,
  SnappedPlacement,
  ValidPlacementRegion,
} from "@/spatial-engine/intelligence/placement/types";
export {
  collectSnapTargets,
  snapRectPlacement,
} from "@/spatial-engine/intelligence/placement/smart-snap";
export type {
  ConstraintAwarePlacementInput,
  ConstraintAwarePlacementResult,
} from "@/spatial-engine/intelligence/placement/constraint-placement";
export {
  isPlacementAllowed,
  nudgeToValidPlacement,
  resolveConstraintAwarePlacement,
  validPlacementRegion,
} from "@/spatial-engine/intelligence/placement/constraint-placement";
