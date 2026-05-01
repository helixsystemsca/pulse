"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch, isApiMode } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Camera, LayoutGrid, Maximize2, Minimize2 } from "lucide-react";
import type { BlueprintElement, BlueprintLayer } from "@/components/zones-devices/blueprint-types";
import { SYMBOL_DEFAULT, mapApiElement, parseApiBlueprintLayers, toApiPayload } from "@/lib/blueprint-layout";
import { packInfraAssetNotes, parseInfraAssetFromNotes } from "./utils/infraSymbolNotes";
import { packZoneMeta } from "./utils/overlayMeta";
import { ProjectSelector } from "./components/ProjectSelector";
import { useActiveProject } from "./hooks/useActiveProject";
import { useInfrastructureGraph } from "./hooks/useInfrastructureGraph";
import type { FilterRule, GraphFilters, SystemType, TraceRouteResult } from "./utils/graphHelpers";
import { getVisibleGraphElements } from "./utils/graphHelpers";
import { MODES } from "./mapBuilderModes";
import { useBuilderMode } from "./hooks/useBuilderMode";
import { Sidebar } from "./components/Sidebar";
import { CanvasWrapper } from "./components/CanvasWrapper";
import { RightPanel } from "./components/RightPanel";
import type { AnnotateKind, AssetDrawShape, ConnectFlow, PrimaryMode } from "./mapBuilderTypes";
import { bboxFromFlatPoly, uniqueLabel } from "./utils/mapBuilderHelpers";
import type { StageViewport } from "./components/MapSemanticDrawLayer";

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
  const { activeMode, setActiveMode, modeConfig } = useBuilderMode();
  const { activeProjectId, setActiveProjectId } = useActiveProject();

  // UI state — Infrastructure Map Builder modes (intent-first)
  const [primaryMode, setPrimaryMode] = useState<PrimaryMode>("select");
  const [assetShape, setAssetShape] = useState<AssetDrawShape>("rectangle");
  const [connectFlow, setConnectFlow] = useState<ConnectFlow>("pick");
  const [annotateKind, setAnnotateKind] = useState<AnnotateKind>("symbol");
  const [defaultSystemType, setDefaultSystemType] = useState<SystemType>("telemetry");
  const [stageViewport, setStageViewport] = useState<StageViewport | null>(null);

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
  const [workspaceFullscreen, setWorkspaceFullscreen] = useState(false);

  useEffect(() => {
    if (primaryMode !== "connect") setConnectDraftFromId(null);
  }, [primaryMode]);

  useEffect(() => {
    setDefaultSystemType(modeConfig.defaultSystemType);
  }, [activeMode, modeConfig.defaultSystemType]);

  useEffect(() => {
    if (!modeConfig.ui.showSystemLayerToggles) {
      setActiveSystems({ fiber: true, irrigation: true, electrical: true, telemetry: true });
    }
  }, [activeMode, modeConfig.ui.showSystemLayerToggles]);

  useEffect(() => {
    const cfg = MODES[activeMode];
    if (!cfg.allowedPrimaryModes.has(primaryMode)) {
      setPrimaryMode("select");
      setConnectDraftFromId(null);
    }
  }, [activeMode, primaryMode]);

  useEffect(() => {
    const cfg = MODES[activeMode];
    if (!cfg.allowedAnnotateKinds.has(annotateKind)) {
      setAnnotateKind("symbol");
    }
  }, [activeMode, annotateKind]);

  useEffect(() => {
    if (!modeConfig.ui.showTraceRoute && traceMode) {
      setTraceMode(false);
      setTraceStartId(null);
      setTraceEndId(null);
      setTraceResult(null);
    }
  }, [modeConfig.ui.showTraceRoute, traceMode]);

  useEffect(() => {
    setSelectedAssets([]);
    setSelectedConnections([]);
    setSelectedBlueprintElementId(null);
    setTraceMode(false);
    setTraceStartId(null);
    setTraceEndId(null);
    setTraceResult(null);
    setConnectDraftFromId(null);
  }, [activeProjectId]);

  // Graph data layer — strictly scoped to active project (server-enforced)
  const graph = useInfrastructureGraph(activeProjectId);

  // Blueprint (existing drawing) data
  const [blueprints, setBlueprints] = useState<BlueprintSummary[]>([]);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>("");
  const [blueprintDetail, setBlueprintDetail] = useState<BlueprintDetail | null>(null);
  const [bpLoading, setBpLoading] = useState(false);
  const [bpError, setBpError] = useState<string | null>(null);

  useEffect(() => {
    if (!isApiMode() || !activeProjectId) {
      setBlueprints([]);
      setSelectedBlueprintId("");
      setBpError(null);
      return;
    }
    void (async () => {
      try {
        const list = await apiFetch<BlueprintSummary[]>(
          `/api/blueprints?project_id=${encodeURIComponent(activeProjectId)}`,
        );
        setBlueprints(list);
        setSelectedBlueprintId((cur) => (cur && list.some((b) => b.id === cur) ? cur : list[0]?.id ?? ""));
        setBpError(null);
      } catch (e: unknown) {
        setBlueprints([]);
        setSelectedBlueprintId("");
        setBpError(e instanceof Error ? e.message : "Failed to load blueprints");
      }
    })();
  }, [activeProjectId]);

  useEffect(() => {
    if (!workspaceFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWorkspaceFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [workspaceFullscreen]);

  useEffect(() => {
    if (!workspaceFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [workspaceFullscreen]);

  useEffect(() => {
    if (!isApiMode() || !selectedBlueprintId || !activeProjectId) {
      setBlueprintDetail(null);
      return;
    }
    let cancel = false;
    setBpLoading(true);
    setBpError(null);
    void (async () => {
      try {
        const d = await apiFetch<BlueprintDetail>(
          `/api/blueprints/${selectedBlueprintId}?project_id=${encodeURIComponent(activeProjectId)}`,
        );
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
  }, [selectedBlueprintId, activeProjectId]);

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
    if (!blueprintDetail || !isApiMode() || !activeProjectId) return;
    const updated = await apiFetch<BlueprintDetail>(
      `/api/blueprints/${blueprintDetail.id}?project_id=${encodeURIComponent(activeProjectId)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          name: blueprintDetail.name,
          elements: toApiPayload(next),
          tasks: blueprintDetail.tasks ?? [],
          layers: blueprintLayers,
        }),
      },
    );
    setBlueprintDetail(updated);
  }

  function editableBlueprintElements(): BlueprintElement[] {
    if (!blueprintDetail) return [];
    return blueprintDetail.elements.map(mapApiElement).filter((e) => !hiddenBlueprintElementIds.has(e.id));
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

  const connectMode = primaryMode === "connect";

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

    // Connect mode — pick two assets (draw mode uses the canvas segment tool)
    if (connectMode && connectFlow === "pick") {
      if (!connectDraftFromId) {
        setConnectDraftFromId(id);
        setSelectedAssets([id]);
        setSelectedConnections([]);
        return;
      }
      if (connectDraftFromId && connectDraftFromId !== id) {
        await graph.createConnection({
          from_asset_id: connectDraftFromId,
          to_asset_id: id,
          system_type: defaultSystemType,
          connection_type: "link",
        });
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

  function handleSnapshotStub() {
    console.info("[Infrastructure Map Builder] Save Snapshot (stub)", {
      blueprintId: blueprintDetail?.id ?? null,
      assets: graph.assets,
      connections: graph.connections,
      attributes: graph.attributes ?? [],
    });
  }

  const mapSemantic = useMemo(() => {
    if (!isApiMode() || !blueprintDetail || !activeProjectId) return null;

    return {
      viewport: stageViewport,
      disabled: traceMode || bpLoading,
      drawConnectionSnapRadiusWorld: modeConfig.interaction.drawConnectionSnapRadiusWorld,
      allowedPrimaryModes: modeConfig.allowedPrimaryModes,
      allowedAnnotateKinds: modeConfig.allowedAnnotateKinds,
      primaryMode,
      assetShape,
      connectFlow,
      annotateKind,
      onSemanticAssetShape: async (payload: {
        shape: AssetDrawShape;
        blueprint: {
          type: "rectangle" | "ellipse" | "polygon";
          x: number;
          y: number;
          width?: number;
          height?: number;
          path_points?: number[];
          name: string;
        };
        assetCenter: { x: number; y: number };
        assetDefaults: { type: string; system_type: SystemType; name: string };
      }) => {
        const names = graph.assets.map((a) => a.name ?? "");
        const label = uniqueLabel(payload.assetDefaults.name, names);
        const created = await graph.createAsset({
          name: label,
          type: payload.assetDefaults.type,
          system_type: defaultSystemType,
          x: payload.assetCenter.x,
          y: payload.assetCenter.y,
          notes: null,
        });
        const elId = crypto.randomUUID();
        let bpEl: BlueprintElement;
        if (payload.blueprint.type === "polygon" && payload.blueprint.path_points?.length) {
          const bb = bboxFromFlatPoly(payload.blueprint.path_points);
          bpEl = {
            id: elId,
            type: "polygon",
            x: bb.x,
            y: bb.y,
            path_points: payload.blueprint.path_points,
            name: uniqueLabel("Area", names),
            symbol_notes: packInfraAssetNotes(created.id),
          };
        } else {
          bpEl = {
            id: elId,
            type: payload.blueprint.type,
            x: payload.blueprint.x,
            y: payload.blueprint.y,
            width: payload.blueprint.width,
            height: payload.blueprint.height,
            name: label,
            symbol_notes: packInfraAssetNotes(created.id),
          };
        }
        await persistBlueprintElements([...editableBlueprintElements(), bpEl]);
        setSelectedAssets([created.id]);
        setSelectedBlueprintElementId(null);
        setSelectedConnections([]);
      },
      onSemanticConnectionDraw: async (fromId: string, toId: string) => {
        await graph.createConnection({
          from_asset_id: fromId,
          to_asset_id: toId,
          system_type: defaultSystemType,
          connection_type: "link",
        });
        setConnectDraftFromId(null);
        setSelectedConnections([]);
        setSelectedAssets([]);
      },
      onSemanticZonePolygon: async (pts: number[], _label: string) => {
        const bb = bboxFromFlatPoly(pts);
        const zoneNames = blueprintElements.filter((e) => e.type === "zone").map((e) => e.name ?? "");
        const nm = uniqueLabel("Zone", zoneNames);
        const elId = crypto.randomUUID();
        const zn = packZoneMeta({ zone_type: "area", notes: "" });
        const bpEl: BlueprintElement = {
          id: elId,
          type: "zone",
          x: bb.x,
          y: bb.y,
          width: bb.w,
          height: bb.h,
          path_points: pts,
          name: nm,
          metadata: { isRoom: true, name: nm },
          ...(zn ? { symbol_notes: zn } : {}),
        };
        await persistBlueprintElements([...editableBlueprintElements(), bpEl]);
        setSelectedBlueprintElementId(elId);
        setSelectedAssets([]);
        setSelectedConnections([]);
      },
      onSemanticAnnotateSymbol: async (x: number, y: number) => {
        const elId = crypto.randomUUID();
        const bpEl: BlueprintElement = {
          id: elId,
          type: "symbol",
          x,
          y,
          width: SYMBOL_DEFAULT,
          height: SYMBOL_DEFAULT,
          symbol_type: "marker",
          name: "Marker",
        };
        await persistBlueprintElements([...editableBlueprintElements(), bpEl]);
        setSelectedBlueprintElementId(elId);
        setSelectedAssets([]);
        setSelectedConnections([]);
      },
      onSemanticAnnotateSketch: async (pts: number[]) => {
        const bb = bboxFromFlatPoly(pts);
        const elId = crypto.randomUUID();
        const bpEl: BlueprintElement = {
          id: elId,
          type: "path",
          x: bb.x,
          y: bb.y,
          path_points: pts,
          symbol_type: "map_sketch",
          name: "Region",
        };
        await persistBlueprintElements([...editableBlueprintElements(), bpEl]);
        setSelectedBlueprintElementId(elId);
        setSelectedAssets([]);
        setSelectedConnections([]);
      },
      onSemanticAnnotateText: async (x: number, y: number) => {
        const elId = crypto.randomUUID();
        const w = 132;
        const h = 44;
        const bpEl: BlueprintElement = {
          id: elId,
          type: "symbol",
          x: x - w / 2,
          y: y - h / 2,
          width: w,
          height: h,
          symbol_type: "label",
          name: "Note",
        };
        await persistBlueprintElements([...editableBlueprintElements(), bpEl]);
        setSelectedBlueprintElementId(elId);
        setSelectedAssets([]);
        setSelectedConnections([]);
      },
      onSemanticAnnotatePen: async (pts: number[]) => {
        const bb = bboxFromFlatPoly(pts);
        const elId = crypto.randomUUID();
        const bpEl: BlueprintElement = {
          id: elId,
          type: "path",
          x: bb.x,
          y: bb.y,
          path_points: pts,
          symbol_type: "map_pen",
          name: "Markup",
        };
        await persistBlueprintElements([...editableBlueprintElements(), bpEl]);
        setSelectedBlueprintElementId(elId);
        setSelectedAssets([]);
        setSelectedConnections([]);
      },
    };
  }, [
    annotateKind,
    assetShape,
    blueprintDetail,
    blueprintElements,
    bpLoading,
    connectFlow,
    defaultSystemType,
    graph,
    primaryMode,
    stageViewport,
    traceMode,
    modeConfig,
    activeProjectId,
  ]);

  const projectReady = Boolean(activeProjectId);

  const topBar = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ds-foreground">Infrastructure map</p>
        <p className={`mt-0.5 text-xs text-ds-muted ${workspaceFullscreen ? "hidden sm:block" : ""}`}>
          Unified Infrastructure Map Builder — structured assets, connections, and zones on your facility image.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ProjectSelector value={activeProjectId} onChange={setActiveProjectId} disabled={bpLoading} />
        <select
          className="app-field w-[min(100%,22rem)]"
          value={selectedBlueprintId}
          onChange={(e) => setSelectedBlueprintId(e.target.value)}
          disabled={!projectReady || bpLoading || blueprints.length === 0}
        >
          {blueprints.length === 0 ? <option value="">No blueprints yet</option> : null}
          {blueprints.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <button type="button" className="ds-btn-secondary inline-flex items-center gap-1.5" onClick={handleSnapshotStub} title="Placeholder — future versioned snapshots">
          <Camera className="h-4 w-4" aria-hidden />
          Save snapshot
        </button>
      </div>
    </div>
  );

  const workspaceChrome = (
    <>
      <span id="drawings-workspace-title" className="sr-only">
        Infrastructure map workspace
      </span>
      <Sidebar
          projectReady={projectReady}
          semanticMode={activeMode}
          onSemanticModeChange={setActiveMode}
          modeConfig={modeConfig}
          activeSystems={activeSystems}
          onToggleSystem={(s) => setActiveSystems((prev) => ({ ...prev, [s]: !(prev[s] !== false) }))}
          primaryMode={primaryMode}
          onPrimaryModeChange={(m) => {
            setPrimaryMode(m);
            if (m !== "connect") setConnectDraftFromId(null);
          }}
          assetShape={assetShape}
          onAssetShapeChange={setAssetShape}
          connectFlow={connectFlow}
          onConnectFlowChange={setConnectFlow}
          annotateKind={annotateKind}
          onAnnotateKindChange={setAnnotateKind}
          defaultSystemType={defaultSystemType}
          onDefaultSystemTypeChange={setDefaultSystemType}
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
          ) : !projectReady ? (
            <div className="relative flex min-h-[420px] flex-1 flex-col items-center justify-center rounded-lg border border-ds-border bg-ds-secondary/40 p-6">
              <p className="max-w-md text-center text-sm font-semibold text-ds-foreground">Select a project to start building</p>
              <p className="mt-2 max-w-md text-center text-xs text-ds-muted">
                Assets, connections, zones, and blueprint edits are scoped to one project. Choose a project in the bar above to load data and enable tools.
              </p>
            </div>
          ) : !blueprintDetail ? (
            <div className="rounded-lg border border-ds-border bg-ds-secondary/40 p-4">
              <p className="text-sm text-ds-muted">
                {blueprints.length === 0
                  ? "No blueprints are linked to this project yet. Create a blueprint for this project (or assign project_id) to use the map canvas."
                  : "Choose a blueprint above to load the map canvas."}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-2 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  {connectMode && connectFlow === "pick" && connectDraftFromId ? (
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
                      const raw = blueprintDetail?.elements.find((e) => e.id === id);
                      if (raw) {
                        const mapped = mapApiElement(raw);
                        const linkedAssetId = parseInfraAssetFromNotes(mapped.symbol_notes);
                        if (linkedAssetId && graph.assetsById.has(linkedAssetId)) {
                          setSelectedAssets([linkedAssetId]);
                          setSelectedBlueprintElementId(null);
                          setSelectedConnections([]);
                          return;
                        }
                      }
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
                      if (connectMode && connectFlow === "pick" && connectDraftFromId) return;
                      clearSelection();
                    }}
                    dimForTrace={Boolean(traceResult)}
                    graphDraggableAssets={primaryMode === "select" && !traceMode}
                    mapSemantic={mapSemantic}
                    onStageViewport={setStageViewport}
                    directedConnections={modeConfig.graphRules.directedEdges}
                    snapConnectPreviewToAssets={modeConfig.interaction.snapConnectPreviewToAssets}
                  />
                );
              })()}
            </>
          )}
        </main>

        <RightPanel
          inspectorVariant={modeConfig.inspector}
          selectedAssets={selectedAssets}
          selectedConnections={selectedConnections}
          asset={selectedAsset}
          connection={selectedConnection}
          blueprintElement={
            selectedAssets.length === 0 && selectedConnections.length === 0 ? selectedBlueprintElement : null
          }
          onClose={() => {
            setSelectedAssets([]);
            setSelectedConnections([]);
            setSelectedBlueprintElementId(null);
          }}
          disabled={graph.loading}
          onSaveAsset={async (patch) => {
            if (selectedAssets.length !== 1) return;
            await graph.updateAsset(selectedAssets[0]!, patch);
          }}
          onSaveBlueprintPatch={async (id, patch) => {
            const els = editableBlueprintElements().map((e) => (e.id === id ? { ...e, ...patch } : e));
            await persistBlueprintElements(els);
          }}
          onLoadAttributes={async (opts) => {
            const rows = await graph.listAttributes(opts);
            return rows.map((r) => ({ id: r.id, key: r.key, value: r.value }));
          }}
          onAddAttribute={async (opts) => {
            await graph.upsertAttribute(opts);
          }}
        />
    </>
  );

  const fullscreenPortal =
    workspaceFullscreen && typeof document !== "undefined"
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-[280] bg-black/50 backdrop-blur-[1px]"
              aria-hidden
              role="presentation"
              onClick={() => setWorkspaceFullscreen(false)}
            />
            <div
              className="fixed left-[max(0.5rem,env(safe-area-inset-left))] right-[max(0.5rem,env(safe-area-inset-right))] top-[max(0.5rem,env(safe-area-inset-top))] bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[290] flex min-h-0 flex-col overflow-hidden rounded-xl border border-ds-border/70 bg-ds-primary shadow-2xl sm:left-3 sm:right-3 sm:top-3 sm:bottom-3"
              role="dialog"
              aria-modal="true"
              aria-labelledby="drawings-workspace-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-ds-border/70 bg-ds-secondary/10 px-3 py-2">
                <div className="min-w-0 flex-1">{topBar}</div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-ds-border/80 bg-ds-secondary/95 px-2.5 py-1.5 text-xs font-semibold text-ds-foreground shadow-sm hover:bg-ds-primary/90"
                  onClick={() => setWorkspaceFullscreen(false)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                    Exit fullscreen
                  </span>
                </button>
              </div>
              {(bpError || graph.error) ? (
                <p className="shrink-0 border-b border-ds-border/60 px-3 py-2 text-sm text-ds-danger">{bpError ?? graph.error}</p>
              ) : null}
              <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">{workspaceChrome}</div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className="flex min-h-0 w-full max-w-none flex-col gap-2">
      <PageHeader
        icon={LayoutGrid}
        title="Drawings"
        description="Infrastructure Map Builder — place assets, connections, and zones directly on the map."
        actions={
          <button
            type="button"
            className="ds-btn-secondary inline-flex items-center gap-2"
            onClick={() => setWorkspaceFullscreen(true)}
            title="Open map in fullscreen"
          >
            <Maximize2 className="h-4 w-4" aria-hidden />
            Fullscreen
          </button>
        }
      />

      {!workspaceFullscreen ? (
        <div className="rounded-md border border-ds-border/70 bg-ds-secondary/10 px-3 py-2">
          {topBar}
          {(bpError || graph.error) ? <p className="mt-3 text-sm text-ds-danger">{bpError ?? graph.error}</p> : null}
        </div>
      ) : null}

      {!workspaceFullscreen ? (
        <div className="relative flex min-h-[min(72vh,560px)] min-w-0 flex-1 overflow-hidden rounded-md border border-ds-border/70 bg-ds-primary sm:min-h-[min(76vh,640px)]">
          {workspaceChrome}
        </div>
      ) : (
        fullscreenPortal
      )}
    </div>
  );
}

