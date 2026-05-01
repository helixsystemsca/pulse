"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, isApiMode } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { LayoutGrid } from "lucide-react";
import type { BlueprintElement, BlueprintLayer } from "@/components/zones-devices/blueprint-types";
import { mapApiElement, parseApiBlueprintLayers, toApiPayload } from "@/lib/blueprint-layout";
import { useInfrastructureGraph } from "./hooks/useInfrastructureGraph";
import type { FilterRule, GraphFilters, SystemType, TraceRouteResult } from "./utils/graphHelpers";
import { getVisibleGraphElements, nearestAssetId } from "./utils/graphHelpers";
import { Sidebar } from "./components/Sidebar";
import { CanvasWrapper } from "./components/CanvasWrapper";
import { RightPanel } from "./components/RightPanel";

type ToolId = "select" | "draw" | "add_asset" | "connect";

type BlueprintSummary = { id: string; name: string; created_at: string };
type ApiBlueprintElement = Parameters<typeof mapApiElement>[0];
type BlueprintDetail = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  elements: ApiBlueprintElement[];
  layers?: unknown;
  tasks?: Array<{ id: string; title: string; mode: string; content: string | string[]; linked_element_ids: string[] }>;
};

// id="f1k29x"
type FilterRuleLocal = {
  entity: "asset" | "connection";
  key: string;
  operator: "equals" | "not_equals" | "gt" | "lt" | "contains";
  value: string | number | boolean;
};

function useDocumentDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

export default function DrawingsPage() {
  const isDark = useDocumentDark();
  const theme = isDark ? ("dark" as const) : ("light" as const);

  // UI state
  const [tool, setTool] = useState<ToolId>("select");
  const [activeSystems, setActiveSystems] = useState<Record<SystemType, boolean>>({
    fiber: true,
    irrigation: true,
    electrical: true,
    telemetry: true,
  });
  // filters
  const [filterRules, setFilterRules] = useState<FilterRuleLocal[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [selectedBlueprintElementId, setSelectedBlueprintElementId] = useState<string | null>(null);

  const [hiddenBlueprintElementIds, setHiddenBlueprintElementIds] = useState<Set<string>>(() => new Set());

  const [traceMode, setTraceMode] = useState(false);
  const [traceStartId, setTraceStartId] = useState<string | null>(null);
  const [traceEndId, setTraceEndId] = useState<string | null>(null);
  const [traceResult, setTraceResult] = useState<TraceRouteResult | null>(null);

  const [connectDraftFromId, setConnectDraftFromId] = useState<string | null>(null);

  // Graph data layer
  const graph = useInfrastructureGraph();

  // Blueprint (existing drawing) data
  const [blueprints, setBlueprints] = useState<BlueprintSummary[]>([]);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>("");
  const [blueprintDetail, setBlueprintDetail] = useState<BlueprintDetail | null>(null);
  const [bpLoading, setBpLoading] = useState(false);
  const [bpError, setBpError] = useState<string | null>(null);

  useEffect(() => {
    if (!isApiMode()) return;
    void (async () => {
      try {
        const list = await apiFetch<BlueprintSummary[]>("/api/blueprints");
        setBlueprints(list);
        setSelectedBlueprintId((cur) => (cur && list.some((b) => b.id === cur) ? cur : list[0]?.id ?? ""));
      } catch (e: unknown) {
        setBlueprints([]);
        setSelectedBlueprintId("");
        setBpError(e instanceof Error ? e.message : "Failed to load blueprints");
      }
    })();
  }, []);

  useEffect(() => {
    if (!isApiMode() || !selectedBlueprintId) {
      setBlueprintDetail(null);
      return;
    }
    let cancel = false;
    setBpLoading(true);
    setBpError(null);
    void (async () => {
      try {
        const d = await apiFetch<BlueprintDetail>(`/api/blueprints/${selectedBlueprintId}`);
        if (!cancel) setBlueprintDetail(d);
      } catch (e: unknown) {
        if (!cancel) setBpError(e instanceof Error ? e.message : "Failed to load blueprint");
      } finally {
        if (!cancel) setBpLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [selectedBlueprintId]);

  const blueprintElements: BlueprintElement[] = useMemo(() => {
    const els = blueprintDetail ? blueprintDetail.elements.map(mapApiElement) : [];
    return els.filter((e) => !hiddenBlueprintElementIds.has(e.id));
  }, [blueprintDetail, hiddenBlueprintElementIds]);

  const blueprintLayers: BlueprintLayer[] = useMemo(() => {
    return blueprintDetail ? parseApiBlueprintLayers(blueprintDetail.layers) : [];
  }, [blueprintDetail]);

  const selectedBlueprintElement = useMemo(() => {
    if (!selectedBlueprintElementId) return null;
    return blueprintElements.find((e) => e.id === selectedBlueprintElementId) ?? null;
  }, [blueprintElements, selectedBlueprintElementId]);

  async function persistBlueprintElements(next: BlueprintElement[]) {
    if (!blueprintDetail) return;
    await apiFetch(`/api/blueprints/${blueprintDetail.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: blueprintDetail.name,
        elements: toApiPayload(next),
        tasks: blueprintDetail.tasks ?? [],
        layers: blueprintLayers,
      }),
    });
  }

  function clearSelection() {
    setSelectedAssets([]);
    setSelectedConnections([]);
    setSelectedBlueprintElementId(null);
  }

  const selectedAsset =
    selectedAssets.length === 1 ? graph.assetsById.get(selectedAssets[0]!) ?? null : null;
  const selectedConnection =
    selectedConnections.length === 1 ? graph.connectionsById.get(selectedConnections[0]!) ?? null : null;

  const connectMode = tool === "connect";

  const canConvertToAsset = selectedBlueprintElement?.type === "rectangle";
  const canConvertToConnection = selectedBlueprintElement?.type === "connection";

  async function convertRectangleToAsset() {
    const el = selectedBlueprintElement;
    if (!el || el.type !== "rectangle") return;
    const w = el.width ?? 80;
    const h = el.height ?? 60;
    const cx = el.x + w / 2;
    const cy = el.y + h / 2;
    const name = prompt("Asset name?", el.name ?? "Building") ?? "";
    if (!name.trim()) return;
    const type = (prompt("Asset type?", "building") ?? "building").trim() || "building";
    const system_type = (prompt("System (fiber|irrigation|electrical|telemetry)?", "telemetry") ?? "telemetry") as SystemType;
    const created = await graph.createAsset({ name: name.trim(), type, system_type, x: cx, y: cy, notes: null });

    // Hide/remove original rectangle from blueprint persistence
    const next = blueprintElements.filter((e) => e.id !== el.id);
    await persistBlueprintElements(next);
    setHiddenBlueprintElementIds((prev) => {
      const n = new Set(prev);
      n.add(el.id);
      return n;
    });
    setSelectedBlueprintElementId(null);
    setSelectedAssets([created.id]);
    setSelectedConnections([]);
  }

  async function convertLineToConnection() {
    const el = selectedBlueprintElement;
    if (!el || el.type !== "connection") return;
    const pts = el.path_points ?? [];
    if (pts.length < 4) return;
    const ax = pts[0]!;
    const ay = pts[1]!;
    const bx = pts[pts.length - 2]!;
    const by = pts[pts.length - 1]!;
    const aId = nearestAssetId(graph.assets, ax, ay);
    const bId = nearestAssetId(graph.assets, bx, by);
    if (!aId || !bId || aId === bId) {
      alert("Could not find two nearby assets to connect. Create assets first.");
      return;
    }
    const system_type = (prompt("System (fiber|irrigation|electrical|telemetry)?", "telemetry") ?? "telemetry") as SystemType;
    await graph.createConnection({ from_asset_id: aId, to_asset_id: bId, system_type, connection_type: "link" });

    // Hide/remove original line from blueprint persistence
    const next = blueprintElements.filter((e) => e.id !== el.id);
    await persistBlueprintElements(next);
    setHiddenBlueprintElementIds((prev) => {
      const n = new Set(prev);
      n.add(el.id);
      return n;
    });
    setSelectedBlueprintElementId(null);
  }

  async function onTraceRoute() {
    setTraceResult(null);
    setTraceStartId(null);
    setTraceEndId(null);
    setTraceMode((v) => !v);
  }

  async function handlePickAsset(id: string, shiftKey: boolean) {
    // Trace route selection flow
    if (traceMode) {
      if (!traceStartId) {
        setTraceStartId(id);
        setSelectedAssets([id]);
        setSelectedConnections([]);
        return;
      }
      if (!traceEndId) {
        setTraceEndId(id);
        setSelectedAssets([id]);
        const res = await graph.traceRoute({ start_asset_id: traceStartId, end_asset_id: id, filters: filterRules as unknown as any[] });
        setTraceResult(res);
        return;
      }
      // restart trace flow
      setTraceStartId(id);
      setTraceEndId(null);
      setTraceResult(null);
      setSelectedAssets([id]);
      return;
    }

    // Connect mode selection flow
    if (connectMode) {
      if (!connectDraftFromId) {
        setConnectDraftFromId(id);
        setSelectedAssets([id]);
        setSelectedConnections([]);
        return;
      }
      if (connectDraftFromId && connectDraftFromId !== id) {
        const system_type = (prompt("System (fiber|irrigation|electrical|telemetry)?", "telemetry") ?? "telemetry") as SystemType;
        await graph.createConnection({ from_asset_id: connectDraftFromId, to_asset_id: id, system_type, connection_type: "link" });
        setConnectDraftFromId(null);
        setSelectedAssets([id]);
        return;
      }
      return;
    }

    // Normal select / multi-select
    setSelectedBlueprintElementId(null);
    if (!shiftKey) {
      setSelectedAssets([id]);
      setSelectedConnections([]);
      return;
    }
    setSelectedConnections((prev) => prev); // keep connections as-is for shift toggles
    setSelectedAssets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handlePickConnection(id: string, shiftKey: boolean) {
    setSelectedBlueprintElementId(null);
    if (!shiftKey) {
      setSelectedConnections([id]);
      setSelectedAssets([]);
      return;
    }
    setSelectedAssets((prev) => prev); // keep assets as-is for shift toggles
    setSelectedConnections((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const topBar = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ds-foreground">Infrastructure map</p>
        <p className="mt-0.5 text-xs text-ds-muted">
          Graph overlay (assets + connections) layered on top of existing drawings.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="app-field w-[min(100%,22rem)]"
          value={selectedBlueprintId}
          onChange={(e) => setSelectedBlueprintId(e.target.value)}
          disabled={bpLoading || blueprints.length === 0}
        >
          {blueprints.length === 0 ? <option value="">No blueprints yet</option> : null}
          {blueprints.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <Link href="/zones-devices/blueprint" className="ds-btn-secondary" prefetch={false}>
          Open designer
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-2">
      <PageHeader icon={LayoutGrid} title="Drawings" description="Multi-system infrastructure overlays on your facility maps." />

      <div className="rounded-md border border-ds-border/70 bg-ds-secondary/10 px-3 py-2">
        {topBar}
        {(bpError || graph.error) ? <p className="mt-3 text-sm text-ds-danger">{bpError ?? graph.error}</p> : null}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-md border border-ds-border/70 bg-ds-primary">
        <Sidebar
          activeSystems={activeSystems}
          onToggleSystem={(s) => setActiveSystems((prev) => ({ ...prev, [s]: !(prev[s] !== false) }))}
          tool={tool}
          onToolChange={(t) => {
            setTool(t);
            setConnectDraftFromId(null);
            if (t === "draw") {
              // keep existing drawing tool accessible without rewriting the canvas
              window.open("/zones-devices/blueprint", "_blank", "noopener,noreferrer");
              setTool("select");
            }
          }}
          onTraceRoute={() => void onTraceRoute()}
          traceActive={traceMode}
          filterRules={filterRules as unknown as FilterRule[]}
          onAddFilterRule={(r) => setFilterRules((prev) => [...prev, r as unknown as FilterRuleLocal])}
          onRemoveFilterRule={(idx) => setFilterRules((prev) => prev.filter((_, i) => i !== idx))}
          onPresetAvailableFiber={() =>
            setFilterRules((prev) => [
              ...prev,
              { entity: "asset", key: "strands_available", operator: "gt", value: 0 },
            ])
          }
        />

        <main className="flex min-h-0 flex-1 flex-col p-0">
          {bpLoading ? (
            <div className="flex min-h-[420px] items-center justify-center">
              <p className="text-sm text-ds-muted">Loading canvas…</p>
            </div>
          ) : !isApiMode() ? (
            <div className="rounded-lg border border-ds-border bg-ds-secondary/40 p-4">
              <p className="text-sm text-ds-muted">Connect to the API to load saved drawings and infrastructure overlays.</p>
            </div>
          ) : blueprintElements.length === 0 ? (
            <div className="rounded-lg border border-ds-border bg-ds-secondary/40 p-4">
              <p className="text-sm text-ds-muted">No blueprint loaded yet. Create one in the designer.</p>
            </div>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-2 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  {canConvertToAsset ? (
                    <button type="button" className="ds-btn-secondary" onClick={() => void convertRectangleToAsset()}>
                      Convert to Asset
                    </button>
                  ) : null}
                  {canConvertToConnection ? (
                    <button type="button" className="ds-btn-secondary" onClick={() => void convertLineToConnection()}>
                      Convert to Connection
                    </button>
                  ) : null}
                  {connectMode && connectDraftFromId ? (
                    <span className="text-xs font-semibold text-ds-muted">Connect: pick destination asset…</span>
                  ) : null}
                  {traceMode ? (
                    <span className="text-xs font-semibold text-ds-muted">
                      Trace route: {traceStartId ? "pick end asset…" : "pick start asset…"}
                    </span>
                  ) : null}
                </div>
                {traceResult ? (
                  <div className="text-xs text-ds-muted">
                    Hops: <span className="font-semibold text-ds-foreground">{Math.max(0, traceResult.asset_ids.length - 1)}</span>
                  </div>
                ) : null}
                {traceResult?.reason ? (
                  <div className="text-xs font-semibold text-ds-warning">
                    {traceResult.reason}
                  </div>
                ) : null}
              </div>

              {(() => {
                const vis = getVisibleGraphElements(
                  { systems: activeSystems } satisfies GraphFilters,
                  graph.assets,
                  graph.connections,
                  graph.attributesByEntityId,
                  filterRules as unknown as FilterRule[],
                );
                return (
                  <CanvasWrapper
                    elements={blueprintElements}
                    layers={blueprintLayers}
                    theme={theme}
                    fitResetKey={blueprintDetail?.id}
                    assets={vis.visibleAssets}
                    connections={vis.visibleConnections}
                    activeSystems={activeSystems}
                    selectedAssets={selectedAssets}
                    selectedConnections={selectedConnections}
                    traceResult={traceResult}
                    connectMode={connectMode}
                    connectDraftFromId={connectDraftFromId}
                    dimAssetIds={vis.dimAssetIds}
                    dimConnectionIds={vis.dimConnectionIds}
                    onPickBlueprintElementId={(id) => {
                      setSelectedBlueprintElementId(id);
                      setSelectedAssets([]);
                      setSelectedConnections([]);
                    }}
                    onSelectAssetId={(id, shiftKey) => void handlePickAsset(id, shiftKey)}
                    onSelectConnectionId={(id, shiftKey) => handlePickConnection(id, shiftKey)}
                    onAssetDragEnd={(id, x, y) => {
                      graph.optimisticMoveAsset(id, x, y);
                      void graph.updateAsset(id, { x, y });
                    }}
                    onCanvasClearSelection={() => {
                      if (connectMode && connectDraftFromId) return;
                      clearSelection();
                    }}
                    dimForTrace={Boolean(traceResult)}
                  />
                );
              })()}
            </>
          )}
        </main>

        <RightPanel
          selectedAssets={selectedAssets}
          selectedConnections={selectedConnections}
          asset={selectedAsset}
          connection={selectedConnection}
          onClose={() => {
            setSelectedAssets([]);
            setSelectedConnections([]);
          }}
          disabled={graph.loading}
          onSaveAsset={async (patch) => {
            if (selectedAssets.length !== 1) return;
            await graph.updateAsset(selectedAssets[0]!, patch);
          }}
          onLoadAttributes={async (opts) => {
            const rows = await graph.listAttributes(opts);
            return rows.map((r) => ({ id: r.id, key: r.key, value: r.value }));
          }}
          onAddAttribute={async (opts) => {
            await graph.createAttribute(opts);
          }}
        />
      </div>
    </div>
  );
}

