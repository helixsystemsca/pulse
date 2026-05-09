"use client";

import {
  Circle as CircleIcon,
  Hexagon,
  PenLine,
  Pencil,
  Square,
  StickyNote,
  Type,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
/** Field labels — Poppins regular via drawings workspace root. */
const FIELD_LABEL = "text-xs font-normal text-ds-muted";

/** Narrow rail: uniform weight with the drawings toolbar. */
const GRAPH_PANEL_BTN = cn(
  buttonVariants({ surface: "light", intent: "secondary" }),
  "inline-flex min-h-8 w-full items-center justify-center px-3 py-1.5 text-center text-xs font-normal leading-tight tracking-normal",
);
import type { FilterRule, SystemType, TraceRouteResult } from "../utils/graphHelpers";
import type { AnnotateKind, AssetDrawShape, ConnectFlow, PrimaryMode } from "../mapBuilderTypes";
import type { BuilderSemanticMode, MapModeConfig } from "../mapBuilderModes";
import { MODES } from "../mapBuilderModes";
import type { WorkspaceTool } from "../workspaceTools";

/**
 * Infrastructure map tool panel — filters, layers, presets, and trace stay first-class
 * (always visible at top). Draw-tool options stack below without hiding graph controls.
 */
export function ToolPanel({
  activeTool,
  apiConnected,
  toolsLocked,
  toolsLockedHint,
  semanticMode,
  onSemanticModeChange,
  modeConfig,
  activeSystems,
  onToggleSystem,
  primaryMode,
  assetShape,
  onAssetShapeChange,
  connectFlow,
  onConnectFlowChange,
  annotateKind,
  onAnnotateKindChange,
  defaultSystemType,
  onDefaultSystemTypeChange,
  filterRules,
  onAddFilterRule,
  onRemoveFilterRule,
  onPresetAvailableFiber,
  onPresetNearCapacity,
  onPresetActiveOnly,
  traceMode,
  traceStartId,
  traceEndId,
  traceStartLabel,
  traceEndLabel,
  traceResult,
  onTraceRoute,
}: {
  activeTool: WorkspaceTool;
  apiConnected: boolean;
  toolsLocked: boolean;
  toolsLockedHint: string;
  semanticMode: BuilderSemanticMode;
  onSemanticModeChange: (m: BuilderSemanticMode) => void;
  modeConfig: MapModeConfig;
  activeSystems: Record<SystemType, boolean>;
  onToggleSystem: (s: SystemType) => void;
  primaryMode: PrimaryMode;
  assetShape: AssetDrawShape;
  onAssetShapeChange: (s: AssetDrawShape) => void;
  connectFlow: ConnectFlow;
  onConnectFlowChange: (f: ConnectFlow) => void;
  annotateKind: AnnotateKind;
  onAnnotateKindChange: (k: AnnotateKind) => void;
  defaultSystemType: SystemType;
  onDefaultSystemTypeChange: (s: SystemType) => void;
  filterRules: FilterRule[];
  onAddFilterRule: (r: FilterRule) => void;
  onRemoveFilterRule: (idx: number) => void;
  onPresetAvailableFiber: () => void;
  onPresetNearCapacity: () => void;
  onPresetActiveOnly: () => void;
  traceMode: boolean;
  traceStartId: string | null;
  traceEndId: string | null;
  traceStartLabel: string | null;
  traceEndLabel: string | null;
  traceResult: TraceRouteResult | null;
  onTraceRoute: () => void;
}) {
  const [entity, setEntity] = useState<FilterRule["entity"]>("asset");
  const [key, setKey] = useState("");
  const [operator, setOperator] = useState<FilterRule["operator"]>("equals");
  const [value, setValue] = useState("");

  const parseValue = (raw: string): string | number | boolean => {
    const t = raw.trim();
    if (t === "true") return true;
    if (t === "false") return false;
    const n = Number(t);
    if (t !== "" && Number.isFinite(n)) return n;
    return t;
  };

  const sysRow = (s: SystemType, label: string, dot: string) => (
    <label
      key={s}
      className="flex cursor-pointer items-center justify-between gap-2 border-b border-ds-border/40 px-2.5 py-2 text-xs font-normal text-ds-foreground last:border-b-0 hover:bg-ds-interactive-hover"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
        <span className="min-w-0 truncate">{label}</span>
      </span>
      <input
        type="checkbox"
        checked={activeSystems[s] !== false}
        onChange={() => onToggleSystem(s)}
        className="h-4 w-4 rounded border-slate-300"
      />
    </label>
  );

  const annotateBtn = (kind: AnnotateKind, label: string, Icon: typeof StickyNote) => {
    const allowed = apiConnected && modeConfig.allowedAnnotateKinds.has(kind) && !toolsLocked;
    return (
      <button
        key={kind}
        type="button"
        title={toolsLocked ? toolsLockedHint : label}
        disabled={!allowed}
        className={`inline-flex h-9 flex-1 items-center justify-center gap-1 border border-ds-border/50 text-xs ${
          !allowed
            ? "cursor-not-allowed opacity-35"
            : annotateKind === kind
              ? "border-ds-success/80 bg-ds-success/15"
              : "hover:bg-ds-interactive-hover-strong"
        }`}
        onClick={() => allowed && onAnnotateKindChange(kind)}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
      </button>
    );
  };

  const modeEntries = (Object.keys(MODES) as BuilderSemanticMode[]).map((k) => ({ key: k, cfg: MODES[k] }));

  const panelTitle = (t: string) => (
    <p className="border-b border-[#e2e6ec] px-4 py-2.5 text-sm font-normal text-ds-muted dark:border-ds-border/60">
      {t}
    </p>
  );

  const contextualTitle = () => {
    switch (activeTool) {
      case "select":
        return null;
      case "asset":
        return "Asset placement";
      case "connect":
        return "Connection";
      case "zone":
        return "Zone";
      case "door":
        return "Door";
      case "annotate":
        return "Annotate";
      case "trace":
        return "Trace diagnostics";
      default: {
        const _x: never = activeTool;
        return _x;
      }
    }
  };

  const showContextual =
    activeTool === "asset" ||
    activeTool === "connect" ||
    activeTool === "zone" ||
    activeTool === "door" ||
    activeTool === "annotate" ||
    activeTool === "trace";

  return (
    <aside className="flex w-[240px] shrink-0 flex-col overflow-y-auto border-r border-[#e2e6ec] bg-white dark:border-ds-border/80 dark:bg-ds-secondary/20">
      {panelTitle("Graph & filters")}
      <div className="space-y-3 border-b border-ds-border/70 px-3 py-3">
        <div className="space-y-1">
          <p className={FIELD_LABEL}>Semantic mode</p>
          <select
            className="app-field min-h-9 w-full !py-1.5 !text-xs leading-snug"
            value={semanticMode}
            title={toolsLocked ? toolsLockedHint : undefined}
            disabled={toolsLocked}
            onChange={(e) => onSemanticModeChange(e.target.value as BuilderSemanticMode)}
          >
            {modeEntries.map(({ key, cfg }) => (
              <option key={key} value={key}>
                {cfg.label}
              </option>
            ))}
          </select>
        </div>

        {modeConfig.ui.showSystemLayerToggles ? (
          <div>
            <p className={cn(FIELD_LABEL, "mb-1")}>System layers</p>
            <div className="overflow-hidden rounded-md border border-ds-border/60">
              {sysRow("fiber", "Fiber", "bg-blue-500")}
              {sysRow("irrigation", "Irrigation", "bg-emerald-500")}
              {sysRow("electrical", "Electrical", "bg-amber-500")}
              {sysRow("telemetry", "Telemetry", "bg-slate-400")}
            </div>
          </div>
        ) : null}

        {modeConfig.ui.showInfrastructureFilters ? (
          <div className="space-y-2">
            <p className={FIELD_LABEL}>Attribute filters</p>
            <div className="space-y-2 border border-ds-border/60 bg-ds-primary/20 p-2">
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  className="app-field min-h-9 !py-1.5 !text-xs leading-snug"
                  value={entity}
                  onChange={(e) => setEntity(e.target.value as "asset" | "connection")}
                >
                  <option value="asset">Asset</option>
                  <option value="connection">Connection</option>
                </select>
                <select
                  className="app-field min-h-9 !py-1.5 !text-xs leading-snug"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value as FilterRule["operator"])}
                >
                  <option value="equals">=</option>
                  <option value="not_equals">≠</option>
                  <option value="gt">&gt;</option>
                  <option value="lt">&lt;</option>
                  <option value="contains">contains</option>
                </select>
                <input className="app-field min-h-9 !py-1.5 !text-xs leading-snug" placeholder="key" value={key} onChange={(e) => setKey(e.target.value)} />
                <input className="app-field min-h-9 !py-1.5 !text-xs leading-snug" placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
              <div className="flex w-full flex-col gap-1.5">
                <button
                  type="button"
                  className={GRAPH_PANEL_BTN}
                  disabled={!key.trim()}
                  onClick={() => {
                    const k = key.trim();
                    if (!k) return;
                    onAddFilterRule({ entity, key: k, operator, value: parseValue(value) });
                    setKey("");
                    setValue("");
                  }}
                >
                  Add filter
                </button>
              </div>
            </div>
            <div>
              <p className={cn(FIELD_LABEL, "mb-1")}>Presets</p>
              <div className="flex flex-col gap-1.5">
                <button type="button" className={GRAPH_PANEL_BTN} onClick={onPresetAvailableFiber} title="strands_available &gt; 0">
                  Available fiber
                </button>
                <button type="button" className={GRAPH_PANEL_BTN} onClick={onPresetNearCapacity} title="strands_available &lt; 2">
                  Near capacity
                </button>
                <button type="button" className={GRAPH_PANEL_BTN} onClick={onPresetActiveOnly} title="status = active">
                  Active only
                </button>
              </div>
            </div>
            {filterRules.length > 0 ? (
              <div>
                <p className={cn(FIELD_LABEL, "mb-1")}>Active filters</p>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {filterRules.map((r, i) => (
                    <div
                      key={`${r.entity}-${r.key}-${i}`}
                      className="flex items-center justify-between gap-2 border border-ds-border/50 bg-ds-primary/15 px-2 py-1 text-[11px] text-ds-muted"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-normal text-ds-foreground">{r.entity}</span> · {r.key} {r.operator}{" "}
                        <span className="font-normal text-ds-foreground">{String(r.value)}</span>
                      </span>
                      <button type="button" className="shrink-0 px-1 text-xs hover:bg-ds-interactive-hover-strong" onClick={() => onRemoveFilterRule(i)} aria-label="Remove filter">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-[10px] leading-relaxed text-ds-muted">This semantic mode does not expose infrastructure filters.</p>
        )}

        {modeConfig.ui.showTraceRoute ? (
          <div className="space-y-2 border-t border-ds-border/50 pt-2">
            <p className={FIELD_LABEL}>Trace route</p>
            <p className="text-[10px] leading-relaxed text-ds-muted">
              Pick a start asset, then an end asset on the map. Filters above constrain the graph used for routing.
            </p>
            <div className="space-y-1 rounded border border-ds-border/60 bg-ds-primary/15 px-2 py-1.5 text-[11px] text-ds-muted">
              <div>
                <span className="font-normal text-ds-foreground">Start:</span>{" "}
                {traceStartLabel ?? (traceMode && !traceStartId ? "…pick on map" : "—")}
              </div>
              <div>
                <span className="font-normal text-ds-foreground">End:</span>{" "}
                {traceEndLabel ?? (traceMode && traceStartId && !traceEndId ? "…pick on map" : "—")}
              </div>
            </div>
            <button
              type="button"
              className={cn(
                GRAPH_PANEL_BTN,
                traceMode &&
                  "!border-ds-success !bg-ds-success/20 hover:!bg-ds-success/30 dark:!border-ds-success dark:!bg-ds-success/15 dark:hover:!bg-ds-success/25",
              )}
              title={toolsLocked ? toolsLockedHint : undefined}
              disabled={!apiConnected || toolsLocked}
              onClick={() => apiConnected && !toolsLocked && onTraceRoute()}
            >
              {traceMode ? "Tracing… (click to cancel)" : "Trace route"}
            </button>
            {traceResult ? (
              <div className="space-y-1 border border-ds-border/60 bg-ds-primary/20 px-2 py-2 text-[11px] text-ds-muted">
                <div>
                  Hops:{" "}
                  <span className="font-normal text-ds-foreground">{Math.max(0, traceResult.asset_ids.length - 1)}</span>
                </div>
                {traceResult.reason ? <div className="font-normal text-ds-warning">{traceResult.reason}</div> : null}
                <div className="border-t border-ds-border/40 pt-1.5 text-[10px] italic text-ds-muted">
                  Weak-link analysis: coming soon (constraint-weighted edges).
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-[10px] text-ds-muted">Trace route is not available in this semantic mode.</p>
        )}
      </div>

      {showContextual ? (
        <>
          {panelTitle(contextualTitle() || "Tool")}
          <div className="space-y-3 px-3 py-3">
            {activeTool === "asset" ? (
              <>
                {modeConfig.ui.showDefaultSystemPicker ? (
                  <div className="space-y-1">
                    <p className={FIELD_LABEL}>Default system</p>
                    <select
                      className="app-field min-h-9 w-full !py-1.5 !text-xs leading-snug"
                      value={defaultSystemType}
                      title={toolsLocked ? toolsLockedHint : undefined}
                      disabled={toolsLocked}
                      onChange={(e) => onDefaultSystemTypeChange(e.target.value as SystemType)}
                    >
                      <option value="fiber">Fiber</option>
                      <option value="irrigation">Irrigation</option>
                      <option value="electrical">Electrical</option>
                      <option value="telemetry">Telemetry</option>
                    </select>
                  </div>
                ) : (
                  <p className="text-[10px] text-ds-muted">
                    Mode <span className="font-normal text-ds-foreground">{modeConfig.label}</span> uses{" "}
                    <span className="font-normal text-ds-foreground">{modeConfig.defaultSystemType}</span> for new elements.
                  </p>
                )}
                {primaryMode === "add_asset" && apiConnected ? (
                  <div>
                    <p className={cn(FIELD_LABEL, "mb-2")}>Asset type</p>
                    <div className="grid grid-cols-3 gap-1 border border-ds-border/60 p-2">
                      <button
                        type="button"
                        title={toolsLocked ? toolsLockedHint : "Building footprint"}
                        disabled={toolsLocked}
                        className={`inline-flex h-10 items-center justify-center border text-xs ${
                          assetShape === "rectangle" ? "border-ds-success bg-ds-success/15" : "border-transparent hover:bg-ds-interactive-hover-strong"
                        }`}
                        onClick={() => !toolsLocked && onAssetShapeChange("rectangle")}
                      >
                        <Square className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title={toolsLocked ? toolsLockedHint : "Node / junction"}
                        disabled={toolsLocked}
                        className={`inline-flex h-10 items-center justify-center border text-xs ${
                          assetShape === "ellipse" ? "border-ds-success bg-ds-success/15" : "border-transparent hover:bg-ds-interactive-hover-strong"
                        }`}
                        onClick={() => !toolsLocked && onAssetShapeChange("ellipse")}
                      >
                        <CircleIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title={toolsLocked ? toolsLockedHint : "Custom area"}
                        disabled={toolsLocked}
                        className={`inline-flex h-10 items-center justify-center border text-xs ${
                          assetShape === "polygon" ? "border-ds-success bg-ds-success/15" : "border-transparent hover:bg-ds-interactive-hover-strong"
                        }`}
                        onClick={() => !toolsLocked && onAssetShapeChange("polygon")}
                      >
                        <Hexagon className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] text-ds-muted">Rectangle · circle · polygon (close near first vertex).</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-ds-muted">Use the rail to stay on Asset, then draw on the map.</p>
                )}
              </>
            ) : null}

            {activeTool === "connect" ? (
              <>
                {primaryMode === "connect" ? (
                  <>
                    <div className="grid grid-cols-2 gap-1 border border-ds-border/60 p-1">
                      <button
                        type="button"
                        title={toolsLocked ? toolsLockedHint : undefined}
                        disabled={toolsLocked}
                        className={`inline-flex min-h-8 items-center justify-center px-2 py-1.5 text-center text-xs font-normal leading-tight ${connectFlow === "pick" ? "bg-ds-success/20 text-ds-foreground" : "text-ds-muted hover:bg-ds-interactive-hover-strong"}`}
                        onClick={() => !toolsLocked && onConnectFlowChange("pick")}
                      >
                        Pick 2 assets
                      </button>
                      <button
                        type="button"
                        title={toolsLocked ? toolsLockedHint : undefined}
                        disabled={toolsLocked}
                        className={`inline-flex min-h-8 items-center justify-center px-2 py-1.5 text-center text-xs font-normal leading-tight ${connectFlow === "draw" ? "bg-ds-success/20 text-ds-foreground" : "text-ds-muted hover:bg-ds-interactive-hover-strong"}`}
                        onClick={() => !toolsLocked && onConnectFlowChange("draw")}
                      >
                        Draw
                      </button>
                    </div>
                    <p className="text-[10px] leading-relaxed text-ds-muted">
                      Endpoints snap to nearby assets when snapping is enabled.
                      {!modeConfig.interaction.snapConnectPreviewToAssets ? " Preview follows the pointer without magnet snap." : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-[10px] text-ds-muted">Switch to Connect on the rail, then use the map.</p>
                )}
              </>
            ) : null}

            {activeTool === "zone" ? (
              <p className="text-xs leading-relaxed text-ds-muted">
                Polygon vertices on the map; click near the first point to close. Zones are visual grouping (not edges in the graph).
              </p>
            ) : null}

            {activeTool === "door" ? (
              <p className="text-xs leading-relaxed text-ds-muted">
                Door placement is not enabled here yet. When available, door segments will snap to wall geometry from the facility map.
              </p>
            ) : null}

            {activeTool === "annotate" ? (
              <>
                <div className="grid grid-cols-2 gap-1">
                  {annotateBtn("symbol", "Symbol", StickyNote)}
                  {annotateBtn("text", "Text", Type)}
                  {annotateBtn("sketch", "Region", Pencil)}
                  {annotateBtn("pen", "Pen", PenLine)}
                </div>
                <p className="text-[10px] text-ds-muted">Map overlays only — not written to the infrastructure graph.</p>
              </>
            ) : null}

            {activeTool === "trace" ? (
              <div className="space-y-2 text-[11px] text-ds-muted">
                <p>Use the Trace route section above for start/end and results. The rail keeps trace mode in sync with the map.</p>
                {traceResult ? (
                  <p>
                    Route length: <span className="font-normal text-ds-foreground">{traceResult.asset_ids.length}</span> assets
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </aside>
  );
}
