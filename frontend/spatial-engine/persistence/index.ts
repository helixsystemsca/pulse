export {
  advertisingPersistenceAdapter,
  documentToWallPlan,
  getAdvertisingMockStore,
  seedAdvertisingMockStore,
  wallPlanToDocument,
  type AdvertisingCalibrationDomain,
  type AdvertisingConstraintDomain,
  type AdvertisingInventoryBlockDomain,
  type AdvertisingWallDomain,
} from "@/spatial-engine/persistence/advertising-adapter";
export {
  documentToInfrastructureMap,
  infrastructureMapToDocument,
  infrastructurePersistenceAdapter,
  type InfrastructureAnnotationDomain,
  type InfrastructureAssetDomain,
  type InfrastructureConnectionDomain,
  type InfrastructureMapDomain,
} from "@/spatial-engine/persistence/infrastructure-adapter";
export type { SpatialPersistenceAdapter, SpatialPersistenceResult } from "@/spatial-engine/persistence/types";
