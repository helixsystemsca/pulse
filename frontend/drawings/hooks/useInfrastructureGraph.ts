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

export function useInfrastructureGraph() {
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
    if (!isApiMode()) return;
    setLoading(true);
    setError(null);
    try {
      const [a, c, at] = await Promise.all([
        apiFetch<InfraAsset[]>("/api/assets"),
        apiFetch<InfraConnection[]>("/api/connections"),
        apiFetch<InfraAttribute[]>("/api/attributes"),
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
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createAsset = useCallback(
    async (body: Omit<InfraAsset, "id">) => {
      const created = await apiFetch<InfraAsset>("/api/assets", { method: "POST", body: JSON.stringify(body) });
      setAssets((prev) => [created, ...prev]);
      return created;
    },
    [],
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

  const createConnection = useCallback(async (body: Omit<InfraConnection, "id" | "active">) => {
    const created = await apiFetch<InfraConnection>("/api/connections", { method: "POST", body: JSON.stringify(body) });
    setConnections((prev) => [created, ...prev]);
    return created;
  }, []);

  const listAttributes = useCallback(async (opts: { entity_type: "asset" | "connection"; entity_id: string }) => {
    const sp = new URLSearchParams();
    sp.set("entity_type", opts.entity_type);
    sp.set("entity_id", opts.entity_id);
    return await apiFetch<InfraAttribute[]>(`/api/attributes?${sp.toString()}`);
  }, []);

  const createAttribute = useCallback(async (body: { entity_type: "asset" | "connection"; entity_id: string; key: string; value: string }) => {
    return await apiFetch<InfraAttribute>("/api/attributes", { method: "POST", body: JSON.stringify(body) });
  }, []);

  const traceRoute = useCallback(async (body: { start_asset_id: string; end_asset_id: string; system_type?: SystemType; filters?: unknown[] }) => {
    return await apiFetch<TraceRouteResult>("/api/trace-route", { method: "POST", body: JSON.stringify(body) });
  }, []);

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
    createAttribute,
    traceRoute,
  };
}

