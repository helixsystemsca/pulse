import {
  createAnnotationLayer,
  createGraphLayer,
  type AnnotationFeatureDocument,
  type GraphEdgeDocument,
  type GraphNodeDocument,
} from "@/spatial-engine/document/layers";
import { createEmptySpatialDocument } from "@/spatial-engine/document/create-document";
import { getDocumentLayer } from "@/spatial-engine/document/query";
import { deserializeSpatialDocument, serializeSpatialDocument } from "@/spatial-engine/document/serialization";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import type { SpatialPersistenceAdapter } from "@/spatial-engine/persistence/types";

/** Bundle loaded from `/api/maps` + graph APIs — kept generic to avoid drawings imports. */
export type InfrastructureMapDomain = {
  mapId: string;
  name: string;
  category?: string;
  imageUrl: string | null;
  worldWidth: number;
  worldHeight: number;
  projectId?: string | null;
  assets: InfrastructureAssetDomain[];
  connections: InfrastructureConnectionDomain[];
  annotations: InfrastructureAnnotationDomain[];
};

export type InfrastructureAssetDomain = {
  id: string;
  name: string;
  type: string;
  system_type: string;
  x: number;
  y: number;
  notes?: string | null;
  project_id?: string | null;
  map_id?: string | null;
};

export type InfrastructureConnectionDomain = {
  id: string;
  from_asset_id: string;
  to_asset_id: string;
  system_type: string;
  connection_type: string;
  active: boolean;
  project_id?: string | null;
  map_id?: string | null;
};

export type InfrastructureAnnotationDomain = {
  id: string;
  symbolType: string;
  x: number;
  y: number;
  label?: string;
  notes?: string;
};

const ADAPTER_KEY = "infrastructure";

export function infrastructureMapToDocument(bundle: InfrastructureMapDomain): SpatialDocument {
  const w = Math.max(100, bundle.worldWidth);
  const h = Math.max(100, bundle.worldHeight);

  const doc = createEmptySpatialDocument({
    id: bundle.mapId,
    title: bundle.name,
    workspaceId: "infrastructure",
    coordinateSpace: {
      kind: "pixel",
      linearUnit: "px",
      extent: { minX: 0, minY: 0, maxX: w, maxY: h },
    },
    includeDefaultLayers: false,
  });

  doc.backdrop = {
    kind: bundle.imageUrl ? "image" : "none",
    url: bundle.imageUrl ?? undefined,
    variant: bundle.category,
  };

  doc.metadata.domain = {
    category: bundle.category,
    projectId: bundle.projectId,
  };

  const nodes: GraphNodeDocument[] = bundle.assets.map((a) => ({
    id: a.id,
    position: { x: a.x, y: a.y },
    metadata: {
      name: a.name,
      type: a.type,
      system_type: a.system_type,
      notes: a.notes,
      project_id: a.project_id,
      map_id: a.map_id,
    },
  }));

  const edges: GraphEdgeDocument[] = bundle.connections.map((c) => ({
    id: c.id,
    fromNodeId: c.from_asset_id,
    toNodeId: c.to_asset_id,
    metadata: {
      system_type: c.system_type,
      connection_type: c.connection_type,
      active: c.active,
      project_id: c.project_id,
      map_id: c.map_id,
    },
  }));

  const annotations: AnnotationFeatureDocument[] = bundle.annotations.map((a) => ({
    id: a.id,
    geometry: { kind: "symbol", position: { x: a.x, y: a.y }, symbolType: a.symbolType },
    metadata: { label: a.label, notes: a.notes },
  }));

  doc.layers = [
    createGraphLayer(
      { id: "graph", visible: true, zIndex: 20, persistence: { adapterKey: `${ADAPTER_KEY}.graph` } },
      nodes,
      edges,
    ),
    createAnnotationLayer(
      { id: "annotations", visible: true, zIndex: 30, persistence: { adapterKey: `${ADAPTER_KEY}.annotations` } },
      annotations,
    ),
  ];

  return doc;
}

export function documentToInfrastructureMap(doc: SpatialDocument): InfrastructureMapDomain {
  const graph = getDocumentLayer(doc, "graph");
  const annotations = getDocumentLayer(doc, "annotations");
  const domainMeta = doc.metadata.domain ?? {};

  return {
    mapId: doc.id,
    name: doc.metadata.title ?? doc.id,
    category: domainMeta.category as string | undefined,
    imageUrl: doc.backdrop.url ?? null,
    worldWidth: doc.coordinateSpace.extent.maxX,
    worldHeight: doc.coordinateSpace.extent.maxY,
    projectId: (domainMeta.projectId as string | null) ?? null,
    assets: (graph?.nodes ?? []).map((n) => ({
      id: n.id,
      name: String(n.metadata.name ?? n.id),
      type: String(n.metadata.type ?? "asset"),
      system_type: String(n.metadata.system_type ?? "telemetry"),
      x: n.position.x,
      y: n.position.y,
      notes: (n.metadata.notes as string | null) ?? null,
      project_id: (n.metadata.project_id as string | null) ?? null,
      map_id: (n.metadata.map_id as string | null) ?? null,
    })),
    connections: (graph?.edges ?? []).map((e) => ({
      id: e.id,
      from_asset_id: e.fromNodeId,
      to_asset_id: e.toNodeId,
      system_type: String(e.metadata.system_type ?? "telemetry"),
      connection_type: String(e.metadata.connection_type ?? "link"),
      active: Boolean(e.metadata.active ?? true),
      project_id: (e.metadata.project_id as string | null) ?? null,
      map_id: (e.metadata.map_id as string | null) ?? null,
    })),
    annotations: (annotations?.features ?? []).map((f) => {
      if (f.geometry.kind !== "symbol") {
        return {
          id: f.id,
          symbolType: "unknown",
          x: 0,
          y: 0,
          label: f.metadata.label as string | undefined,
        };
      }
      return {
        id: f.id,
        symbolType: f.geometry.symbolType,
        x: f.geometry.position.x,
        y: f.geometry.position.y,
        label: f.metadata.label as string | undefined,
        notes: f.metadata.notes as string | undefined,
      };
    }),
  };
}

export const infrastructurePersistenceAdapter: SpatialPersistenceAdapter<InfrastructureMapDomain> = {
  workspaceId: "infrastructure",
  adapterKey: ADAPTER_KEY,

  toDocument: infrastructureMapToDocument,
  fromDocument: documentToInfrastructureMap,

  async load(externalId) {
    throw new Error(
      `Infrastructure persistence load("${externalId}") must be implemented by drawings API layer — use toDocument() with fetched bundle.`,
    );
  },

  async save(externalId, domain) {
    throw new Error(
      `Infrastructure persistence save("${externalId}") must be implemented by drawings API layer — persist graph/maps separately.`,
    );
  },

  serialize: serializeSpatialDocument,
  deserialize: deserializeSpatialDocument,
};
