"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, isApiMode } from "@/lib/api";
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

/**
 * Infrastructure graph scoped to a single facility map (`map_id` on the server).
 * `project_id` is omitted for tenant-level facility maps (maps not linked to a pulse project).
 * When `mapId` is null, the graph is cleared (no requests).
 */
export function useInfrastructureGraph(projectId: string | null, mapId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<InfraAsset[]>([]);
  const [connections, setConnections] = useState<InfraConnection[]>([]);
  const [attributes, setAttributes] = useState<InfraAttribute[]>([]);

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

  const refresh = useCallback(async () => {
    if (!isApiMode() || !mapId) {
      setAssets([]);
      setConnections([]);
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
      setAssets(a);
      setConnections(c);
      setAttributes(at);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load infrastructure graph");
      setAssets([]);
      setConnections([]);
      setAttributes([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, mapId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createAsset = useCallback(
    async (body: Omit<InfraAsset, "id" | "project_id" | "map_id">) => {
      if (!mapId) throw new Error("Select a map before creating assets");
      const payload: Record<string, unknown> = { ...body, map_id: mapId };
      if (projectId) payload.project_id = projectId;
      const created = await apiFetch<InfraAsset>("/api/assets", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setAssets((prev) => [created, ...prev]);
      return created;
    },
    [projectId, mapId],
  );

  const updateAsset = useCallback(async (id: string, patch: Partial<Omit<InfraAsset, "id">>) => {
    const updated = await apiFetch<InfraAsset>(`/api/assets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setAssets((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return updated;
  }, []);

  const optimisticMoveAsset = useCallback((id: string, x: number, y: number) => {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, x, y } : a)));
  }, []);

  const createConnection = useCallback(
    async (body: Omit<InfraConnection, "id" | "active" | "project_id" | "map_id">) => {
      if (!mapId) throw new Error("Select a map before creating connections");
      const payload: Record<string, unknown> = { ...body, map_id: mapId };
      if (projectId) payload.project_id = projectId;
      const created = await apiFetch<InfraConnection>("/api/connections", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setConnections((prev) => [created, ...prev]);
      return created;
    },
    [projectId, mapId],
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
    [projectId, mapId],
  );

  /** Upserts by (entity_type, entity_id, key); merges into local attribute list (no duplicate rows). */
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
    [projectId, mapId],
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
