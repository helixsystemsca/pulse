/**
 * Advertising domain bridge to canonical SpatialDocument.
 * Persistence remains in domain APIs/mocks — geometry uses shared serialization.
 */
import type { FacilityWallPlan } from "@/modules/communications/advertising-mapper/types";
import type { SpatialDocument } from "@/spatial-engine/document";
import { deserializeSpatialDocument, serializeSpatialDocument } from "@/spatial-engine/document/serialization";
import {
  advertisingPersistenceAdapter,
  documentToWallPlan,
  seedAdvertisingMockStore,
  wallPlanToDocument,
  type AdvertisingWallDomain,
} from "@/spatial-engine/persistence/advertising-adapter";

export function facilityWallToSpatialDocument(wall: FacilityWallPlan): SpatialDocument {
  return wallPlanToDocument(wall as AdvertisingWallDomain);
}

export function spatialDocumentToFacilityWall(doc: SpatialDocument): FacilityWallPlan {
  return documentToWallPlan(doc) as FacilityWallPlan;
}

export {
  advertisingPersistenceAdapter,
  deserializeSpatialDocument,
  seedAdvertisingMockStore,
  serializeSpatialDocument,
};
