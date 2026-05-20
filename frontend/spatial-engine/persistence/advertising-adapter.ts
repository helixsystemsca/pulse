import {
  createConstraintLayer,
  createInventoryLayer,
  type ConstraintFeatureDocument,
  type InventoryItemDocument,
} from "@/spatial-engine/document/layers";
import { createEmptySpatialDocument } from "@/spatial-engine/document/create-document";
import { getDocumentLayer } from "@/spatial-engine/document/query";
import { deserializeSpatialDocument, serializeSpatialDocument } from "@/spatial-engine/document/serialization";
import type { SpatialCalibration, SpatialDocument } from "@/spatial-engine/document/types";
import type { SpatialPersistenceAdapter } from "@/spatial-engine/persistence/types";
import { DEFAULT_INCH_BASE_PX_PER_INCH } from "@/spatial-engine/coordinates/inch-space";

/** Minimal wall plan shape — matches advertising-mapper `FacilityWallPlan` without importing domain module. */
export type AdvertisingWallDomain = {
  id: string;
  name: string;
  width_inches: number;
  height_inches: number;
  backdropKind: string;
  backdropUrl?: string;
  backdropNaturalWidth?: number;
  backdropNaturalHeight?: number;
  gridSnapInches?: number;
  blocks: AdvertisingInventoryBlockDomain[];
  constraints: AdvertisingConstraintDomain[];
  calibration?: AdvertisingCalibrationDomain | null;
};

export type AdvertisingInventoryBlockDomain = {
  id: string;
  name: string;
  x: number;
  y: number;
  width_inches: number;
  height_inches: number;
  status: string;
  sponsor?: string;
  zone?: string;
  visibilityTier?: string;
  priceTier?: string;
  inventoryId?: string;
  mountingType?: string;
  expiryDate?: string;
  assetUrl?: string;
};

export type AdvertisingConstraintDomain = {
  id: string;
  type: "polygon";
  constraintType: string;
  points: readonly number[];
  label?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AdvertisingCalibrationDomain = {
  pointA: { x: number; y: number };
  pointB: { x: number; y: number };
  realWorldDistanceInches: number;
};

const ADAPTER_KEY = "advertising";

/** In-memory store for mock/demo persistence until API ships. */
const mockStore = new Map<string, AdvertisingWallDomain>();

export function wallPlanToDocument(wall: AdvertisingWallDomain): SpatialDocument {
  const doc = createEmptySpatialDocument({
    id: wall.id,
    title: wall.name,
    workspaceId: "advertising",
    coordinateSpace: {
      kind: "inch",
      linearUnit: "in",
      extent: {
        minX: 0,
        minY: 0,
        maxX: wall.width_inches,
        maxY: wall.height_inches,
      },
      basePixelsPerUnit: DEFAULT_INCH_BASE_PX_PER_INCH,
    },
    includeDefaultLayers: false,
  });

  doc.backdrop = {
    kind: wall.backdropUrl ? "image" : "none",
    url: wall.backdropUrl,
    naturalWidth: wall.backdropNaturalWidth,
    naturalHeight: wall.backdropNaturalHeight,
    variant: wall.backdropKind,
  };

  doc.calibration = wall.calibration ? domainCalibrationToSpatial(wall.calibration) : null;

  doc.metadata.domain = {
    gridSnapInches: wall.gridSnapInches,
    backdropKind: wall.backdropKind,
  };

  const inventoryItems: InventoryItemDocument[] = wall.blocks.map((b) => ({
    id: b.id,
    geometry: {
      kind: "rect",
      x: b.x,
      y: b.y,
      width: b.width_inches,
      height: b.height_inches,
    },
    metadata: {
      name: b.name,
      status: b.status,
      sponsor: b.sponsor,
      zone: b.zone,
      visibilityTier: b.visibilityTier,
      priceTier: b.priceTier,
      inventoryId: b.inventoryId,
      mountingType: b.mountingType,
      expiryDate: b.expiryDate,
      assetUrl: b.assetUrl,
    },
  }));

  const constraintFeatures: ConstraintFeatureDocument[] = wall.constraints.map((c) => ({
    id: c.id,
    geometry: { kind: "polygon", points: [...c.points] },
    metadata: {
      constraintType: c.constraintType,
      label: c.label,
      notes: c.notes,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    },
  }));

  doc.layers = [
    createConstraintLayer(
      { id: "constraints", visible: true, zIndex: 10, persistence: { adapterKey: `${ADAPTER_KEY}.constraints` } },
      constraintFeatures,
    ),
    createInventoryLayer(
      { id: "inventory", visible: true, zIndex: 20, persistence: { adapterKey: `${ADAPTER_KEY}.inventory` } },
      inventoryItems,
    ),
  ];

  return doc;
}

export function documentToWallPlan(doc: SpatialDocument): AdvertisingWallDomain {
  const inventory = getDocumentLayer(doc, "inventory");
  const constraints = getDocumentLayer(doc, "constraints");
  const domainMeta = doc.metadata.domain ?? {};

  return {
    id: doc.id,
    name: doc.metadata.title ?? doc.id,
    width_inches: doc.coordinateSpace.extent.maxX,
    height_inches: doc.coordinateSpace.extent.maxY,
    backdropKind: String(domainMeta.backdropKind ?? "neutral"),
    backdropUrl: doc.backdrop.url,
    backdropNaturalWidth: doc.backdrop.naturalWidth,
    backdropNaturalHeight: doc.backdrop.naturalHeight,
    gridSnapInches: typeof domainMeta.gridSnapInches === "number" ? domainMeta.gridSnapInches : undefined,
    calibration: doc.calibration ? spatialCalibrationToDomain(doc.calibration) : null,
    blocks: (inventory?.items ?? []).map((item) => ({
      id: item.id,
      name: String(item.metadata.name ?? item.id),
      x: item.geometry.x,
      y: item.geometry.y,
      width_inches: item.geometry.width,
      height_inches: item.geometry.height,
      status: String(item.metadata.status ?? "available"),
      sponsor: item.metadata.sponsor as string | undefined,
      zone: item.metadata.zone as string | undefined,
      visibilityTier: item.metadata.visibilityTier as string | undefined,
      priceTier: item.metadata.priceTier as string | undefined,
      inventoryId: item.metadata.inventoryId as string | undefined,
      mountingType: item.metadata.mountingType as string | undefined,
      expiryDate: item.metadata.expiryDate as string | undefined,
      assetUrl: item.metadata.assetUrl as string | undefined,
    })),
    constraints: (constraints?.features ?? []).map((f) => ({
      id: f.id,
      type: "polygon" as const,
      constraintType: String(f.metadata.constraintType ?? "blocked"),
      points: [...f.geometry.points],
      label: f.metadata.label as string | undefined,
      notes: f.metadata.notes as string | undefined,
      createdAt: f.metadata.createdAt as string | undefined,
      updatedAt: f.metadata.updatedAt as string | undefined,
    })),
  };
}

function domainCalibrationToSpatial(cal: AdvertisingCalibrationDomain): SpatialCalibration {
  return {
    status: "applied",
    distanceUnit: "in",
    reference: {
      pointA: cal.pointA,
      pointB: cal.pointB,
      realWorldDistance: cal.realWorldDistanceInches,
    },
  };
}

function spatialCalibrationToDomain(cal: SpatialCalibration): AdvertisingCalibrationDomain {
  const inches =
    cal.distanceUnit === "in"
      ? cal.reference.realWorldDistance
      : cal.reference.realWorldDistance;
  return {
    pointA: cal.reference.pointA,
    pointB: cal.reference.pointB,
    realWorldDistanceInches: inches,
  };
}

export const advertisingPersistenceAdapter: SpatialPersistenceAdapter<AdvertisingWallDomain> = {
  workspaceId: "advertising",
  adapterKey: ADAPTER_KEY,

  toDocument: wallPlanToDocument,
  fromDocument: documentToWallPlan,

  async load(externalId) {
    const row = mockStore.get(externalId);
    if (!row) throw new Error(`Advertising wall not found: ${externalId}`);
    return row;
  },

  async save(externalId, domain) {
    mockStore.set(externalId, domain);
    return domain;
  },

  serialize: serializeSpatialDocument,
  deserialize: deserializeSpatialDocument,
};

/** Seed mock persistence store (used by advertising-mapper mocks). */
export function seedAdvertisingMockStore(walls: AdvertisingWallDomain[]): void {
  for (const w of walls) {
    mockStore.set(w.id, w);
  }
}

export function getAdvertisingMockStore(): ReadonlyMap<string, AdvertisingWallDomain> {
  return mockStore;
}
