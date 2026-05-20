"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, isApiMode } from "@/lib/api";
import {
  infrastructureMapToDocument,
  type InfrastructureMapDomain,
} from "@/spatial-engine/persistence/infrastructure-adapter";
import type { BlueprintElement, BlueprintLayer } from "@/components/zones-devices/blueprint-types";
import { mapApiElement, type ApiBlueprintElement } from "@/lib/blueprint-layout";
import { mergeBlueprintIntoDocument } from "@/spatial-engine/persistence/blueprint-bridge";
import {
  blueprintElementsFromSpatialDocument,
  blueprintLayersFromSpatialDocument,
  graphAssetsFromDocument,
  graphConnectionsFromDocument,
} from "@/spatial-engine/runtime/selectors";
import {
  selectActiveDocument,
  selectActiveDocumentRevision,
  useSpatialRuntimeStore,
} from "@/spatial-engine/runtime/spatial-runtime-store";
import { upsertGraphLayer } from "@/spatial-engine/runtime/document-mutations";
import type { GraphEdgeDocument, GraphNodeDocument } from "@/spatial-engine/document/layers";
import type { InfraAsset, InfraConnection, SystemType, TraceRouteResult } from "../utils/graphHelpers";
import { buildAdjacency } from "../utils/graphHelpers";

type InfraAttribute = {
  id: string;
  entity_type: "asset" | "connection";
  entity_id: string;
  key: string;
  value: string;
  created_at: string;
};

function assetsUrl(projectId: string | null, mapId: string, systemType?: string): string {
  const sp = new URLSearchParams({ map_id: mapId });
  if (projectId) sp.set("project_id", projectId);
  if (systemType) sp.set("system_type", systemType);
  return `/api/assets?${sp.toString()}`;
}

function connectionsUrl(projectId: string | null, mapId: string, systemType?: string): string {
  const sp = new URLSearchParams({ map_id: mapId });
  if (projectId) sp.set("project_id", projectId);
  if (systemType) sp.set("system_type", systemType);
  return `/api/connections?${sp.toString()}`;
}

function attributesUrl(projectId: string | null, mapId: string): string {
  const sp = new URLSearchParams({ map_id: mapId });
  if (projectId) sp.set("project_id", projectId);
  return `/api/attributes?${sp.toString()}`;
}

function domainAssetsToInfra(assets: ReturnType<typeof graphAssetsFromDocument>): InfraAsset[] {
  return assets.map((a) => ({
    ...a,
    system_type: a.system_type as SystemType,
  }));
}

function domainConnectionsToInfra(connections: ReturnType<typeof graphConnectionsFromDocument>): InfraConnection[] {
  return connections.map((c) => ({
    ...c,
    system_type: c.system_type as SystemType,
  }));
}

function syncGraphLayer(
  doc: NonNullable<ReturnType<typeof selectActiveDocument>>,
  assets: InfraAsset[],
  connections: InfraConnection[],
) {
  const nodes: GraphNodeDocument[] = assets.map((a) => ({
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
  const edges: GraphEdgeDocument[] = connections.map((c) => ({
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
  return upsertGraphLayer(doc, nodes, edges);
}

export type DrawingsSpatialLoadInput = {
  mapId: string;
  name: string;
  category?: string;
  imageUrl: string | null;
  worldWidth: number;
  worldHeight: number;
  projectId?: string | null;
};

/**
 * Infrastructure drawings runtime — graph layer in `SpatialDocument` is authoritative.
 * API persistence remains per-entity; loads hydrate the document, mutations update both.
 */
export function useDrawingsSpatialRuntime(
  projectId: string | null,
  mapId: string | null,
  loadInput: DrawingsSpatialLoadInput | null,
) {
  const loadDocument = useSpatialRuntimeStore((s) => s.loadDocument);
  const resetSession = useSpatialRuntimeStore((s) => s.resetSession);
  const updateActiveDocument = useSpatialRuntimeStore((s) => s.updateActiveDocument);
  const activeDocument = useSpatialRuntimeStore(selectActiveDocument);
  const revision = useSpatialRuntimeStore(selectActiveDocumentRevision);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attributes, setAttributes] = useState<InfraAttribute[]>([]);

  const assets = useMemo(
    () => domainAssetsToInfra(graphAssetsFromDocument(activeDocument)),
    [activeDocument, revision],
  );
  const connections = useMemo(
    () => domainConnectionsToInfra(graphConnectionsFromDocument(activeDocument)),
    [activeDocument, revision],
  );

  const blueprintElements = useMemo(
    () => blueprintElementsFromSpatialDocument(activeDocument),
    [activeDocument, revision],
  );

  const blueprintLayers = useMemo(
    () => blueprintLayersFromSpatialDocument(activeDocument),
    [activeDocument, revision],
  );

  const assetsById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const connectionsById = useMemo(() => new Map(connections.map((c) => [c.id, c])), [connections]);
  const adjacency = useMemo(() => buildAdjacency(connections), [connections]);

  const attributesByEntityId = useMemo(() => {
    const idx: Record<string, Record<string, string | number | boolean>> = {};
    const parseValue = (raw: string): string | number | boolean => {
      const t = String(raw ?? "").trim();
      if (t === "") return "";
      if (t === "true") return true;
      if (t === "false") return false;
      const n = Number(t);
      if (Number.isFinite(n) && String(n) === t) return n;
      return t;
    };
    for (const a of attributes) {
      const key = `${a.entity_type}:${a.entity_id}`;
      if (!idx[key]) idx[key] = {};
      idx[key]![a.key] = parseValue(a.value);
    }
    return idx;
  }, [attributes]);

  const hydrateFromApi = useCallback(async () => {
    if (!isApiMode() || !mapId) {
      setAttributes([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [a, c, at] = await Promise.all([
        apiFetch<InfraAsset[]>(assetsUrl(projectId, mapId)),
        apiFetch<InfraConnection[]>(connectionsUrl(projectId, mapId)),
        apiFetch<InfraAttribute[]>(attributesUrl(projectId, mapId)),
      ]);
      setAttributes(at);
      const bundle: InfrastructureMapDomain = {
        mapId,
        name: loadInput?.name ?? mapId,
        category: loadInput?.category,
        imageUrl: loadInput?.imageUrl ?? null,
        worldWidth: loadInput?.worldWidth ?? 4200,
        worldHeight: loadInput?.worldHeight ?? 4200,
        projectId: projectId ?? loadInput?.projectId ?? null,
        assets: a.map((row) => ({
          id: row.id,
          name: row.name,
          type: row.type,
          system_type: row.system_type,
          x: row.x,
          y: row.y,
          notes: row.notes,
          project_id: row.project_id,
          map_id: row.map_id,
        })),
        connections: c.map((row) => ({
          id: row.id,
          from_asset_id: row.from_asset_id,
          to_asset_id: row.to_asset_id,
          system_type: row.system_type,
          connection_type: row.connection_type,
          active: row.active,
          project_id: row.project_id,
          map_id: row.map_id,
        })),
        annotations: [],
      };
      loadDocument(infrastructureMapToDocument(bundle), { pushHistory: false });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load infrastructure graph");
      setAttributes([]);
    } finally {
      setLoading(false);
    }
  }, [loadDocument, loadInput, mapId, projectId]);

  useEffect(() => {
    if (!mapId) {
      resetSession("infrastructure");
      setAttributes([]);
      return;
    }
    void hydrateFromApi();
  }, [hydrateFromApi, mapId, resetSession]);

  const refresh = useCallback(async () => {
    await hydrateFromApi();
  }, [hydrateFromApi]);

  const applyGraphToDocument = useCallback(
    (nextAssets: InfraAsset[], nextConnections: InfraConnection[]) => {
      updateActiveDocument((doc) => syncGraphLayer(doc, nextAssets, nextConnections), { pushHistory: true });
    },
    [updateActiveDocument],
  );

  const createAsset = useCallback(
    async (body: Omit<InfraAsset, "id" | "project_id" | "map_id">) => {
      if (!mapId) throw new Error("Select a map before creating assets");
      const payload: Record<string, unknown> = { ...body, map_id: mapId };
      if (projectId) payload.project_id = projectId;
      const created = await apiFetch<InfraAsset>("/api/assets", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      applyGraphToDocument([created, ...assets], connections);
      return created;
    },
    [applyGraphToDocument, assets, connections, mapId, projectId],
  );

  const updateAsset = useCallback(
    async (id: string, patch: Partial<Omit<InfraAsset, "id">>) => {
      const updated = await apiFetch<InfraAsset>(`/api/assets/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      applyGraphToDocument(
        assets.map((a) => (a.id === id ? updated : a)),
        connections,
      );
      return updated;
    },
    [applyGraphToDocument, assets, connections],
  );

  const optimisticMoveAsset = useCallback(
    (id: string, x: number, y: number) => {
      applyGraphToDocument(
        assets.map((a) => (a.id === id ? { ...a, x, y } : a)),
        connections,
      );
    },
    [applyGraphToDocument, assets, connections],
  );

  const createConnection = useCallback(
    async (body: Omit<InfraConnection, "id" | "active" | "project_id" | "map_id">) => {
      if (!mapId) throw new Error("Select a map before creating connections");
      const payload: Record<string, unknown> = { ...body, map_id: mapId };
      if (projectId) payload.project_id = projectId;
      const created = await apiFetch<InfraConnection>("/api/connections", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      applyGraphToDocument(assets, [created, ...connections]);
      return created;
    },
    [applyGraphToDocument, assets, connections, mapId, projectId],
  );

  const listAttributes = useCallback(
    async (opts: { entity_type: "asset" | "connection"; entity_id: string }) => {
      const sp = new URLSearchParams();
      sp.set("entity_type", opts.entity_type);
      sp.set("entity_id", opts.entity_id);
      if (mapId) sp.set("map_id", mapId);
      if (projectId) sp.set("project_id", projectId);
      return await apiFetch<InfraAttribute[]>(`/api/attributes?${sp.toString()}`);
    },
    [mapId, projectId],
  );

  const upsertAttribute = useCallback(
    async (body: { entity_type: "asset" | "connection"; entity_id: string; key: string; value: string }) => {
      const row = await apiFetch<InfraAttribute>("/api/attributes/upsert", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setAttributes((prev) => {
        const rest = prev.filter(
          (a) =>
            !(a.entity_type === body.entity_type && a.entity_id === body.entity_id && a.key === body.key),
        );
        return [row, ...rest];
      });
      return row;
    },
    [],
  );

  const hydrateBlueprintFromApi = useCallback(
    (apiElements: ApiBlueprintElement[], apiLayers: BlueprintLayer[]) => {
      const elements = apiElements.map(mapApiElement);
      updateActiveDocument(
        (doc) => mergeBlueprintIntoDocument(doc, { elements, layers: apiLayers }),
        { pushHistory: false },
      );
    },
    [updateActiveDocument],
  );

  const setBlueprintElements = useCallback(
    (elements: BlueprintElement[], layers?: BlueprintLayer[]) => {
      updateActiveDocument(
        (doc) =>
          mergeBlueprintIntoDocument(doc, {
            elements,
            layers: layers ?? blueprintLayersFromSpatialDocument(doc),
          }),
        { pushHistory: true },
      );
    },
    [updateActiveDocument],
  );

  const traceRoute = useCallback(
    async (body: {
      start_asset_id: string;
      end_asset_id: string;
      system_type?: SystemType;
      filters?: unknown[];
    }) => {
      if (!mapId) throw new Error("Select a map before tracing routes");
      const payload: Record<string, unknown> = { ...body, map_id: mapId };
      if (projectId) payload.project_id = projectId;
      return await apiFetch<TraceRouteResult>("/api/trace-route", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    [mapId, projectId],
  );

  return {
    loading,
    error,
    assets,
    connections,
    assetsById,
    connectionsById,
    adjacency,
    attributes,
    attributesByEntityId,
    activeDocument,
    revision,
    blueprintElements,
    blueprintLayers,
    hydrateBlueprintFromApi,
    setBlueprintElements,
    refresh,
    createAsset,
    updateAsset,
    optimisticMoveAsset,
    createConnection,
    listAttributes,
    upsertAttribute,
    traceRoute,
  };
}
