/**
 * Infrastructure drawings bridge to canonical SpatialDocument.
 * Map/graph API persistence stays in DrawingsPage — this layer normalizes geometry only.
 */
import type { InfraAsset, InfraConnection } from "@/drawings/utils/graphHelpers";
import type { SpatialDocument } from "@/spatial-engine/document";
import {
  documentToInfrastructureMap,
  infrastructureMapToDocument,
  infrastructurePersistenceAdapter,
  type InfrastructureMapDomain,
} from "@/spatial-engine/persistence/infrastructure-adapter";

export type DrawingsMapSpatialInput = {
  mapId: string;
  name: string;
  category?: string;
  imageUrl: string | null;
  worldWidth: number;
  worldHeight: number;
  projectId?: string | null;
  assets: InfraAsset[];
  connections: InfraConnection[];
  annotations?: InfrastructureMapDomain["annotations"];
};

export function drawingsBundleToSpatialDocument(input: DrawingsMapSpatialInput): SpatialDocument {
  return infrastructureMapToDocument({
    mapId: input.mapId,
    name: input.name,
    category: input.category,
    imageUrl: input.imageUrl,
    worldWidth: input.worldWidth,
    worldHeight: input.worldHeight,
    projectId: input.projectId,
    assets: input.assets,
    connections: input.connections,
    annotations: input.annotations ?? [],
  });
}

export function spatialDocumentToDrawingsBundle(doc: SpatialDocument): InfrastructureMapDomain {
  return documentToInfrastructureMap(doc);
}

export { deserializeSpatialDocument, serializeSpatialDocument } from "@/spatial-engine/document/serialization";
export { infrastructurePersistenceAdapter } from "@/spatial-engine/persistence/infrastructure-adapter";
