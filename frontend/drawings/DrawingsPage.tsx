"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, isApiMode } from "@/lib/api";
import type { BlueprintElement, BlueprintLayer } from "@/components/zones-devices/blueprint-types";
import { SYMBOL_DEFAULT, mapApiElement, parseApiBlueprintLayers, toApiPayload } from "@/lib/blueprint-layout";
import { packInfraAssetNotes, parseInfraAssetFromNotes } from "./utils/infraSymbolNotes";
import { packZoneMeta } from "./utils/overlayMeta";
import { useActiveProject } from "./hooks/useActiveProject";
import { useInfrastructureGraph } from "./hooks/useInfrastructureGraph";
import type { FilterRule, GraphFilters, SystemType, TraceRouteResult } from "./utils/graphHelpers";
import { getVisibleGraphElements } from "./utils/graphHelpers";
import { MODES } from "./mapBuilderModes";
import { useBuilderMode } from "./hooks/useBuilderMode";
import { Button } from "@/components/ui/Button";
import type { BlueprintViewportHandle } from "@/components/zones-devices/BlueprintReadOnlyCanvas";
import { CanvasWrapper } from "./components/CanvasWrapper";
import { DrawingCanvasToolbar } from "./components/DrawingCanvasToolbar";
import { DrawingsTopBar } from "./components/DrawingsTopBar";
import {
  getSpatialWorkspace,
  SpatialWorkspaceShell,
  useSpatialWorkspaceTools,
} from "@/spatial-engine/workspace";
import { RightPanel } from "./components/RightPanel";
import { ToolPanel } from "./components/ToolPanel";
import { PRIMARY_TO_TOOL, toolToPrimaryMode, type WorkspaceTool } from "./workspaceTools";
import type { AnnotateKind, AssetDrawShape, ConnectFlow, PrimaryMode } from "./mapBuilderTypes";
import { bboxFromFlatPoly, uniqueLabel } from "./utils/mapBuilderHelpers";
import type { StageViewport } from "./components/MapSemanticDrawLayer";
import { DRAWINGS_BASE_IMAGE_SYMBOL } from "./mapConstants";

type MapSummary = {
  id: string;
  name: string;
  project_id?: string | null;
  category: string;
  created_at: string;
  updated_at: string;
};
type ApiMapElement = Parameters<typeof mapApiElement>[0];
type MapDetail = {
  id: string;
  name: string;
  category: string;
  image_url: string;
  project_id?: string | null;
  created_at: string;
  updated_at: string;
  elements: ApiMapElement[];
  layers?: unknown;
  tasks?: Array<{ id: string; title: string; mode: string; content: string | string[]; linked_element_ids: string[] }>;
};

const TOOLS_LOCKED_HINT = "Upload or select a map image to use drawing tools";
const MAX_BASE_IMAGE_WORLD = 4200;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

function naturalImageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Invalid image"));
    img.src = dataUrl;
  });
}

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

export default function DrawingsPage({ fullscreen = false }: { fullscreen?: boolean }) {
  const router = useRouter();
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
  const [activeTool, setActiveTool] = useState<WorkspaceTool>("select");
  /** Canvas overlay: Select vs Pan (left icon rail still picks Add asset / Connect / Zone / …). */
  const [canvasNavMode, setCanvasNavMode] = useState<"select" | "pan">("select");
  const canvasViewportRef = useRef<BlueprintViewportHandle | null>(null);

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

  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [activeMapId, setActiveMapId] = useState<string>("");
  const [newMapCategory, setNewMapCategory] = useState<string>("General");

  const [mapDetail, setMapDetail] = useState<MapDetail | null>(null);
  const [mapListLoading, setMapListLoading] = useState(false);
  const [mapDetailLoading, setMapDetailLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const mapImageInputRef = useRef<HTMLInputElement>(null);
  const uploadCreatesNewMapRef = useRef(false);
  const [baseWorldSize, setBaseWorldSize] = useState<{ w: number; h: number } | null>(null);

  /** Pulse project for graph API — null for tenant-level facility maps (no project link). */
  const graphProjectId = useMemo(() => {
    const mid = activeMapId.trim();
    if (!mid) return null;
    if (mapDetail?.id === mid) {
      const p = mapDetail.project_id;
      return p != null && String(p).trim() ? String(p).trim() : null;
    }
    const row = maps.find((m) => m.id === mid);
    const p = row?.project_id;
    return p != null && String(p).trim() ? String(p).trim() : null;
  }, [activeMapId, mapDetail, maps]);

  const graph = useInfrastructureGraph(graphProjectId, activeMapId.trim() || null);

  useEffect(() => {
    if (!isApiMode()) {
      setMaps([]);
      setActiveMapId("");
      setMapError(null);
      return;
    }
    let cancel = false;
    setMapListLoading(true);
    setMapError(null);
    void (async () => {
      try {
        const listUrl = activeProjectId
          ? `/api/maps?project_id=${encodeURIComponent(activeProjectId)}`
          : `/api/maps`;
        const list = await apiFetch<MapSummary[]>(listUrl);
        if (cancel) return;
        setMaps(list);
        setActiveMapId((cur) => (cur && list.some((m) => m.id === cur) ? cur : list[0]?.id ?? ""));
        setMapError(null);
      } catch (e: unknown) {
        if (!cancel) {
          setMaps([]);
          setActiveMapId("");
          setMapError(e instanceof Error ? e.message : "Failed to load maps");
        }
      } finally {
        if (!cancel) setMapListLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [activeProjectId]);

  useEffect(() => {
    const url = mapDetail?.image_url?.trim();
    if (!url) {
      setBaseWorldSize(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      let fw = img.naturalWidth;
      let fh = img.naturalHeight;
      const m = Math.max(fw, fh);
      if (m > MAX_BASE_IMAGE_WORLD) {
        const s = MAX_BASE_IMAGE_WORLD / m;
        fw = Math.round(fw * s);
        fh = Math.round(fh * s);
      }
      setBaseWorldSize({ w: fw, h: fh });
    };
    img.onerror = () => setBaseWorldSize(null);
    img.src = url;
  }, [mapDetail?.image_url]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/drawings");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, router]);

  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!isApiMode() || !activeMapId.trim()) {
      setMapDetail(null);
      return;
    }
    let cancel = false;
    setMapDetailLoading(true);
    setMapError(null);
    void (async () => {
      try {
        const d = await apiFetch<MapDetail>(`/api/maps/${encodeURIComponent(activeMapId.trim())}`);
        if (!cancel && d.id === activeMapId) setMapDetail(d);
      } catch (e: unknown) {
        if (!cancel) setMapError(e instanceof Error ? e.message : "Failed to load map");
      } finally {
        if (!cancel) setMapDetailLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [activeMapId]);

  const mapLoading = mapListLoading || mapDetailLoading;

  const blueprintElements: BlueprintElement[] = useMemo(() => {
    if (!mapDetail) return [];
    const els = mapDetail.elements.map(mapApiElement);
    const stripLegacyBase = Boolean(mapDetail.image_url?.trim());
    return els
      .filter((e) => !(stripLegacyBase && e.type === "symbol" && e.symbol_type === DRAWINGS_BASE_IMAGE_SYMBOL))
      .filter((e) => !hiddenBlueprintElementIds.has(e.id));
  }, [mapDetail, hiddenBlueprintElementIds]);

  const blueprintLayers: BlueprintLayer[] = useMemo(() => {
    return mapDetail ? parseApiBlueprintLayers(mapDetail.layers) : [];
  }, [mapDetail]);

  const selectedBlueprintElement = useMemo(() => {
    if (!selectedBlueprintElementId) return null;
    return blueprintElements.find((e) => e.id === selectedBlueprintElementId) ?? null;
  }, [blueprintElements, selectedBlueprintElementId]);

  const selectedBlueprintElementForPanel = useMemo(() => {
    if (!selectedBlueprintElement) return null;
    if (selectedBlueprintElement.symbol_type === DRAWINGS_BASE_IMAGE_SYMBOL) return null;
    return selectedBlueprintElement;
  }, [selectedBlueprintElement]);

  const hasBaseImage = Boolean(mapDetail?.image_url?.trim());

  const persistMapElements = useCallback(
    async (next: BlueprintElement[]) => {
      if (!mapDetail || !isApiMode()) return;
      const updated = await apiFetch<MapDetail>(`/api/maps/${encodeURIComponent(mapDetail.id)}`, {
        method: "PUT",
        json: {
          name: mapDetail.name,
          category: mapDetail.category,
          image_url: mapDetail.image_url ?? "",
          elements: toApiPayload(next),
          tasks: mapDetail.tasks ?? [],
          layers: blueprintLayers,
        },
      });
      setMapDetail(updated);
    },
    [mapDetail, blueprintLayers],
  );

  function editableBlueprintElements(): BlueprintElement[] {
    if (!mapDetail) return [];
    return mapDetail.elements.map(mapApiElement).filter((e) => !hiddenBlueprintElementIds.has(e.id));
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

  function applyWorkspaceTool(tool: WorkspaceTool) {
    setCanvasNavMode("select");
    if (!activeMapId || !hasBaseImage) return;
    if (tool === "trace") {
      if (!modeConfig.ui.showTraceRoute || !activeMapId.trim()) return;
      const willEnable = !traceMode;
      void onTraceRoute();
      setActiveTool(willEnable ? "trace" : "select");
      return;
    }
    if (traceMode) void onTraceRoute();
    setActiveTool(tool);
    if (tool === "door") {
      setPrimaryMode("select");
      return;
    }
    const pm = toolToPrimaryMode(tool);
    if (pm && modeConfig.allowedPrimaryModes.has(pm)) {
      setPrimaryMode(pm);
      if (pm !== "connect") setConnectDraftFromId(null);
    }
  }

  useEffect(() => {
    if (traceMode) {
      setActiveTool("trace");
      return;
    }
    setActiveTool((prev) => (prev === "door" ? "door" : PRIMARY_TO_TOOL[primaryMode]));
  }, [primaryMode, traceMode]);

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

  const openMapImagePicker = useCallback((createNewMap: boolean) => {
    uploadCreatesNewMapRef.current = createNewMap;
    mapImageInputRef.current?.click();
  }, []);

  const onMapImageInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file?.type.startsWith("image/") || !isApiMode() || uploadBusy) return;
      const createNew = uploadCreatesNewMapRef.current;
      uploadCreatesNewMapRef.current = false;
      setUploadBusy(true);
      setMapError(null);
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const { w: nw, h: nh } = await naturalImageSize(dataUrl);
        let fw = nw;
        let fh = nh;
        const m = Math.max(fw, fh);
        if (m > MAX_BASE_IMAGE_WORLD) {
          const s = MAX_BASE_IMAGE_WORLD / m;
          fw = Math.round(fw * s);
          fh = Math.round(fh * s);
        }
        const baseName = file.name.replace(/\.[^/.]+$/, "") || "Map";

        if (createNew || !mapDetail) {
          const pid = activeProjectId?.trim() || null;
          const created = await apiFetch<MapDetail>("/api/maps", {
            method: "POST",
            json: {
              name: baseName,
              project_id: pid,
              category: newMapCategory.trim() || "General",
              image_url: dataUrl,
              elements: [],
              tasks: [],
              layers: [],
            },
          });
          setMaps((prev) => [
            ...prev,
            {
              id: created.id,
              name: created.name,
              project_id: created.project_id ?? pid,
              category: created.category,
              created_at: created.created_at,
              updated_at: created.updated_at,
            },
          ]);
          setActiveMapId(created.id);
          setMapDetail(created);
        } else {
          const withoutBase = mapDetail.elements
            .map(mapApiElement)
            .filter((el) => el.symbol_type !== DRAWINGS_BASE_IMAGE_SYMBOL && !hiddenBlueprintElementIds.has(el.id));
          const updated = await apiFetch<MapDetail>(`/api/maps/${encodeURIComponent(mapDetail.id)}`, {
            method: "PUT",
            json: {
              name: mapDetail.name,
              category: mapDetail.category,
              image_url: dataUrl,
              elements: toApiPayload(withoutBase),
              tasks: mapDetail.tasks ?? [],
              layers: blueprintLayers,
            },
          });
          setMapDetail(updated);
        }
        setSelectedBlueprintElementId(null);
        setSelectedAssets([]);
        setSelectedConnections([]);
      } catch (err: unknown) {
        setMapError(err instanceof Error ? err.message : "Could not upload image");
      } finally {
        setUploadBusy(false);
      }
    },
    [activeProjectId, blueprintLayers, hiddenBlueprintElementIds, mapDetail, newMapCategory, uploadBusy],
  );

  const handleSaveMap = useCallback(async () => {
    if (!mapDetail || !isApiMode()) return;
    setMapError(null);
    try {
      const next = mapDetail.elements.map(mapApiElement).filter((e) => !hiddenBlueprintElementIds.has(e.id));
      await persistMapElements(next);
    } catch (err: unknown) {
      setMapError(err instanceof Error ? err.message : "Save failed");
    }
  }, [mapDetail, hiddenBlueprintElementIds, persistMapElements]);

  useEffect(() => {
    if (!hasBaseImage && traceMode) {
      setTraceResult(null);
      setTraceStartId(null);
      setTraceEndId(null);
      setTraceMode(false);
    }
  }, [hasBaseImage, traceMode]);

  const mapSemantic = useMemo(() => {
    if (!isApiMode() || !mapDetail || !activeMapId.trim() || mapDetail.id !== activeMapId.trim()) return null;

    return {
      viewport: stageViewport,
      disabled: traceMode || mapLoading || !hasBaseImage || canvasNavMode === "pan",
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
        await persistMapElements([...editableBlueprintElements(), bpEl]);
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
        await persistMapElements([...editableBlueprintElements(), bpEl]);
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
        await persistMapElements([...editableBlueprintElements(), bpEl]);
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
        await persistMapElements([...editableBlueprintElements(), bpEl]);
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
        await persistMapElements([...editableBlueprintElements(), bpEl]);
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
        await persistMapElements([...editableBlueprintElements(), bpEl]);
        setSelectedBlueprintElementId(elId);
        setSelectedAssets([]);
        setSelectedConnections([]);
      },
    };
  }, [
    annotateKind,
    assetShape,
    mapDetail,
    blueprintElements,
    mapLoading,
    hasBaseImage,
    connectFlow,
    defaultSystemType,
    graph,
    persistMapElements,
    primaryMode,
    stageViewport,
    traceMode,
    modeConfig,
    activeMapId,
    canvasNavMode,
  ]);

  const apiConnected = Boolean(isApiMode());

  const traceStartLabel = useMemo(() => {
    if (!traceStartId) return null;
    return graph.assetsById.get(traceStartId)?.name ?? traceStartId.slice(0, 8);
  }, [graph.assetsById, traceStartId]);

  const traceEndLabel = useMemo(() => {
    if (!traceEndId) return null;
    return graph.assetsById.get(traceEndId)?.name ?? traceEndId.slice(0, 8);
  }, [graph.assetsById, traceEndId]);

  const toolsLocked = Boolean(isApiMode() && (!activeMapId.trim() || !mapDetail || !hasBaseImage));

  const infrastructureWorkspace = getSpatialWorkspace("infrastructure");
  const infrastructureTools = useMemo(
    () =>
      infrastructureWorkspace.tools.map((t) => {
        if (t.id === "trace") {
          return {
            ...t,
            disabled: !modeConfig.ui.showTraceRoute || !apiConnected || toolsLocked,
            disabledReason: toolsLocked ? TOOLS_LOCKED_HINT : undefined,
          };
        }
        if (t.id === "select" || t.id === "pan") {
          return { ...t, disabled: toolsLocked, disabledReason: toolsLocked ? TOOLS_LOCKED_HINT : undefined };
        }
        if (t.group === "primary") {
          return {
            ...t,
            disabled: toolsLocked || t.disabled,
            disabledReason: toolsLocked ? TOOLS_LOCKED_HINT : t.disabledReason,
          };
        }
        return t;
      }),
    [apiConnected, infrastructureWorkspace.tools, modeConfig.ui.showTraceRoute, toolsLocked],
  );

  const activeRailToolId = canvasNavMode === "pan" ? "pan" : activeTool;

  const onInfrastructureToolChange = useCallback(
    (toolId: string) => {
      if (toolId === "pan") {
        setCanvasNavMode("pan");
        return;
      }
      setCanvasNavMode("select");
      if (toolId === "select") {
        applyWorkspaceTool("select");
        return;
      }
      applyWorkspaceTool(toolId as WorkspaceTool);
    },
    [applyWorkspaceTool],
  );

  useSpatialWorkspaceTools(infrastructureTools, onInfrastructureToolChange, Boolean(mapDetail));

  const workspaceChrome = (
    <SpatialWorkspaceShell
      workspaceId="infrastructure"
      title={mapDetail?.name ?? "Infrastructure map"}
      subtitle={mapDetail?.category}
      activeToolId={activeRailToolId}
      onToolChange={onInfrastructureToolChange}
      tools={infrastructureTools}
      immersive={false}
      className="min-h-0 flex-1"
      leftPanel={
        <ToolPanel
        activeTool={activeTool}
        apiConnected={apiConnected}
        toolsLocked={toolsLocked}
        toolsLockedHint={TOOLS_LOCKED_HINT}
        semanticMode={activeMode}
        onSemanticModeChange={setActiveMode}
        modeConfig={modeConfig}
        activeSystems={activeSystems}
        onToggleSystem={(s) => setActiveSystems((prev) => ({ ...prev, [s]: !(prev[s] !== false) }))}
        primaryMode={primaryMode}
        assetShape={assetShape}
        onAssetShapeChange={setAssetShape}
        connectFlow={connectFlow}
        onConnectFlowChange={setConnectFlow}
        annotateKind={annotateKind}
        onAnnotateKindChange={setAnnotateKind}
        defaultSystemType={defaultSystemType}
        onDefaultSystemTypeChange={setDefaultSystemType}
        filterRules={filterRules as unknown as FilterRule[]}
        onAddFilterRule={(r) => setFilterRules((prev) => [...prev, r as unknown as FilterRuleLocal])}
        onRemoveFilterRule={(idx) => setFilterRules((prev) => prev.filter((_, i) => i !== idx))}
        onPresetAvailableFiber={() =>
          setFilterRules((prev) => [
            ...prev,
            { entity: "asset", key: "strands_available", operator: "gt", value: 0 },
          ])
        }
        onPresetNearCapacity={() =>
          setFilterRules((prev) => [
            ...prev,
            { entity: "asset", key: "strands_available", operator: "lt", value: 2 },
          ])
        }
        onPresetActiveOnly={() =>
          setFilterRules((prev) => [
            ...prev,
            { entity: "asset", key: "status", operator: "equals", value: "active" },
          ])
        }
        traceMode={traceMode}
        traceStartId={traceStartId}
        traceEndId={traceEndId}
        traceStartLabel={traceStartLabel}
        traceEndLabel={traceEndLabel}
        traceResult={traceResult}
        onTraceRoute={() => void onTraceRoute()}
      />
      }
      viewport={
        <>
          <span id="drawings-workspace-title" className="sr-only">
            Infrastructure map workspace
          </span>
          {mapListLoading ? (
            <div className="flex flex-1 items-center justify-center border-l border-[#e2e6ec] bg-[#f4f6f8] dark:border-ds-border/40 dark:bg-ds-primary">
              <p className="text-sm text-ds-muted">Loading maps…</p>
            </div>
          ) : !isApiMode() ? (
            <div className="flex flex-1 flex-col justify-center border-l border-[#e2e6ec] bg-[#f4f6f8] px-4 py-6 dark:border-ds-border/40 dark:bg-ds-secondary/25">
              <p className="text-sm text-ds-muted">Connect to the API to load saved drawings and infrastructure overlays.</p>
            </div>
          ) : maps.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center border-l border-[#e2e6ec] bg-[#f4f6f8] px-6 py-8 dark:border-ds-border/40 dark:bg-ds-secondary/25">
              <p className="max-w-md text-center text-sm font-normal text-ds-foreground">Upload a map image to start</p>
              <p className="mt-2 max-w-md text-center text-xs text-ds-muted">
                {
                  'Add a floor plan, aerial, or site image, then draw infrastructure on top. Use the "Facility map" category for building or zone layouts. Link a project later when this drawing is for a specific job.'
                }
              </p>
              <Button
                type="button"
                variant="primary"
                className="mt-4"
                disabled={uploadBusy}
                onClick={() => openMapImagePicker(true)}
              >
                {uploadBusy ? "Uploading…" : "Upload new image"}
              </Button>
            </div>
          ) : !mapDetail ? (
            <div className="flex flex-1 flex-col justify-center border-l border-[#e2e6ec] bg-[#f4f6f8] px-4 py-6 dark:border-ds-border/40 dark:bg-ds-secondary/25">
              <p className="text-sm text-ds-muted">
                {mapDetailLoading
                  ? "Loading map…"
                  : activeMapId
                    ? "Map could not be loaded. Check your connection and try again."
                    : "Select a map in the header."}
              </p>
            </div>
          ) : (
            <>
              <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 border-b border-ds-border/30 bg-ds-primary/85 px-2 py-1 backdrop-blur-[2px]">
                <div className="flex flex-wrap items-center gap-2">
                  {connectMode && connectFlow === "pick" && connectDraftFromId ? (
                    <span className="pointer-events-none text-[11px] font-normal text-ds-muted">Connect: pick destination…</span>
                  ) : null}
                  {traceMode ? (
                    <span className="pointer-events-none text-[11px] font-normal text-ds-muted">
                      Trace: {traceStartId ? "pick end asset…" : "pick start asset…"}
                    </span>
                  ) : null}
                </div>
                {traceResult ? (
                  <div className="text-[11px] text-ds-muted">
                    Hops: <span className="font-normal text-ds-foreground">{Math.max(0, traceResult.asset_ids.length - 1)}</span>
                  </div>
                ) : null}
                {traceResult?.reason ? (
                  <div className="text-[11px] font-normal text-ds-warning">{traceResult.reason}</div>
                ) : null}
              </div>

              <div className="relative flex min-h-0 flex-1 flex-col">
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
                      ref={canvasViewportRef}
                      key={fullscreen ? "drawings-canvas-fs" : "drawings-canvas-inline"}
                      viewportPanActive={canvasNavMode === "pan"}
                      elements={blueprintElements}
                      layers={blueprintLayers}
                      theme={theme}
                      baseImageUrl={hasBaseImage ? mapDetail.image_url : null}
                      baseImageWorldSize={baseWorldSize}
                      fitResetKey={mapDetail?.id}
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
                        const raw = mapDetail?.elements.find((e) => e.id === id);
                        if (raw) {
                          const mapped = mapApiElement(raw);
                          if (mapped.symbol_type === DRAWINGS_BASE_IMAGE_SYMBOL) return;
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
                      graphDraggableAssets={
                        primaryMode === "select" && !traceMode && hasBaseImage && canvasNavMode !== "pan"
                      }
                      mapSemantic={mapSemantic}
                      onStageViewport={setStageViewport}
                      directedConnections={modeConfig.graphRules.directedEdges}
                      snapConnectPreviewToAssets={modeConfig.interaction.snapConnectPreviewToAssets}
                      sizeCanvasToContainer
                    />
                  );
                })()}
                {!hasBaseImage ? (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-ds-primary/40">
                    <div className="mx-4 max-w-md rounded-lg border border-ds-border/60 bg-background/90 px-6 py-5 text-center shadow-lg backdrop-blur">
                      <h2 className="text-lg font-normal text-ds-foreground">No base image</h2>
                      <p className="mt-2 text-sm text-ds-muted">
                        Upload a top-down image (aerial or floor plan) to start mapping your facility.
                      </p>
                      <Button
                        type="button"
                        variant="primary"
                        className="mt-4"
                        disabled={uploadBusy}
                        onClick={() => openMapImagePicker(false)}
                      >
                        {uploadBusy ? "Uploading…" : "Upload Image"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </>
      }
      floatingControls={
        mapDetail ? <DrawingCanvasToolbar disabled={toolsLocked} viewportRef={canvasViewportRef} /> : undefined
      }
      rightPanel={
        <RightPanel
          selectedAssets={selectedAssets}
          selectedConnections={selectedConnections}
          asset={selectedAsset}
          connection={selectedConnection}
          blueprintElement={
            selectedAssets.length === 0 && selectedConnections.length === 0 ? selectedBlueprintElementForPanel : null
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
            await persistMapElements(els);
          }}
          onLoadAttributes={async (opts) => {
            const rows = await graph.listAttributes(opts);
            return rows.map((r) => ({ id: r.id, key: r.key, value: r.value }));
          }}
          onAddAttribute={async (opts) => {
            await graph.upsertAttribute(opts);
          }}
        />
      }
    />
  );

  const errorBanner =
    mapError || graph.error ? (
      <p className="shrink-0 border-b border-ds-border/60 bg-ds-secondary/25 px-3 py-1.5 text-xs text-ds-danger">{mapError ?? graph.error}</p>
    ) : null;

  return (
    <div
      className={
        fullscreen
          ? "flex h-full min-h-0 w-full flex-col overflow-hidden bg-background font-manrope font-normal"
          : "flex min-h-0 min-h-[calc(100dvh-7rem)] w-full flex-1 flex-col overflow-hidden font-manrope font-normal"
      }
    >
      <input
        ref={mapImageInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={onMapImageInputChange}
      />
      <DrawingsTopBar
        mapsToolbarDisabled={!apiConnected || mapListLoading || uploadBusy}
        activeProjectId={activeProjectId}
        setActiveProjectId={setActiveProjectId}
        maps={maps}
        activeMapId={activeMapId}
        onMapChange={(id) => setActiveMapId(id)}
        newMapCategory={newMapCategory}
        onNewMapCategoryChange={setNewMapCategory}
        onUploadNewMap={() => openMapImagePicker(true)}
        onSaveMap={() => void handleSaveMap()}
        saveDisabled={!mapDetail || mapLoading || uploadBusy}
        fullscreen={fullscreen}
        onEnterFullscreen={() => router.push("/drawings/fullscreen")}
        onExitFullscreen={() => router.push("/drawings")}
      />
      {errorBanner}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{workspaceChrome}</div>
    </div>
  );
}

