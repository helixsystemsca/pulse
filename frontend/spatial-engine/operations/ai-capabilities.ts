import type { SpatialDocument } from "@/spatial-engine/document/types";
import type { WorldPoint, WorldRect } from "@/spatial-engine/types/spatial";

/** Future AI capability identifiers — hosts register providers when models ship. */
export type SpatialAiCapabilityId =
  | "wall_detection"
  | "obstruction_detection"
  | "placement_recommendation"
  | "intelligent_routing"
  | "automated_constraints";

export type SpatialAiCapabilityStatus = "unavailable" | "preview" | "available";

export type SpatialAiCapabilityDescriptor = {
  id: SpatialAiCapabilityId;
  label: string;
  description: string;
  status: SpatialAiCapabilityStatus;
};

export const SPATIAL_AI_CAPABILITIES: SpatialAiCapabilityDescriptor[] = [
  {
    id: "wall_detection",
    label: "Wall detection",
    description: "Detect walls and surfaces from backdrop imagery.",
    status: "unavailable",
  },
  {
    id: "obstruction_detection",
    label: "Obstruction detection",
    description: "Identify obstacles that block placement or routing.",
    status: "unavailable",
  },
  {
    id: "placement_recommendation",
    label: "Placement recommendations",
    description: "Suggest valid inventory positions from constraints and telemetry.",
    status: "unavailable",
  },
  {
    id: "intelligent_routing",
    label: "Intelligent routing",
    description: "Route assets and connections with operational context.",
    status: "unavailable",
  },
  {
    id: "automated_constraints",
    label: "Automated constraints",
    description: "Generate constraint regions from imagery and safety rules.",
    status: "unavailable",
  },
];

export type SpatialAiPlacementRecommendation = {
  rect: WorldRect;
  score: number;
  rationale?: string;
};

export type SpatialAiConstraintProposal = {
  points: number[];
  constraintType: string;
  confidence: number;
};

/** Provider interface — implement per capability when backend models are ready. */
export type SpatialAiProvider = {
  id: SpatialAiCapabilityId;
  status: SpatialAiCapabilityStatus;
  detectWalls?: (doc: SpatialDocument, imageUrl?: string) => Promise<WorldPoint[][]>;
  detectObstructions?: (doc: SpatialDocument) => Promise<WorldPoint[][]>;
  recommendPlacements?: (
    doc: SpatialDocument,
    itemSize: { width: number; height: number },
  ) => Promise<SpatialAiPlacementRecommendation[]>;
  proposeConstraints?: (doc: SpatialDocument) => Promise<SpatialAiConstraintProposal[]>;
};

const providers = new Map<SpatialAiCapabilityId, SpatialAiProvider>();

export function registerSpatialAiProvider(provider: SpatialAiProvider): void {
  providers.set(provider.id, provider);
}

export function getSpatialAiProvider(id: SpatialAiCapabilityId): SpatialAiProvider | undefined {
  return providers.get(id);
}

export function listSpatialAiCapabilities(): SpatialAiCapabilityDescriptor[] {
  return SPATIAL_AI_CAPABILITIES.map((d) => {
    const p = providers.get(d.id);
    return p ? { ...d, status: p.status } : d;
  });
}
