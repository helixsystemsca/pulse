import type { BlueprintElement, BlueprintLayer } from "@/components/zones-devices/blueprint-types";
import { getDocumentLayer } from "@/spatial-engine/document/query";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import {
  blueprintElementsFromDocument,
  blueprintLayersFromDocument,
} from "@/spatial-engine/persistence/blueprint-bridge";
import {
  documentToWallPlan,
  type AdvertisingWallDomain,
} from "@/spatial-engine/persistence/advertising-adapter";
import {
  documentToInfrastructureMap,
  type InfrastructureAssetDomain,
  type InfrastructureConnectionDomain,
} from "@/spatial-engine/persistence/infrastructure-adapter";

export function infrastructureBundleFromDocument(doc: SpatialDocument | null) {
  if (!doc) return null;
  return documentToInfrastructureMap(doc);
}

export function graphAssetsFromDocument(doc: SpatialDocument | null): InfrastructureAssetDomain[] {
  return infrastructureBundleFromDocument(doc)?.assets ?? [];
}

export function graphConnectionsFromDocument(doc: SpatialDocument | null): InfrastructureConnectionDomain[] {
  return infrastructureBundleFromDocument(doc)?.connections ?? [];
}

export function wallPlanFromDocument(doc: SpatialDocument | null): AdvertisingWallDomain | null {
  if (!doc) return null;
  return documentToWallPlan(doc);
}

export function inventoryItemIdsFromDocument(doc: SpatialDocument | null): string[] {
  const layer = doc ? getDocumentLayer(doc, "inventory") : undefined;
  return layer?.items.map((i) => i.id) ?? [];
}

export function blueprintElementsFromSpatialDocument(doc: SpatialDocument | null): BlueprintElement[] {
  return blueprintElementsFromDocument(doc);
}

export function blueprintLayersFromSpatialDocument(doc: SpatialDocument | null): BlueprintLayer[] {
  return blueprintLayersFromDocument(doc);
}
