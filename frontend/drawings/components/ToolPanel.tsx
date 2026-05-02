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
  projectReady,
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
  projectReady: boolean;
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
      className="flex cursor-pointer items-center justify-between gap-2 border-b border-ds-border/40 py-2 text-xs font-medium text-ds-foreground last:border-b-0 hover:bg-ds-primary/30"
    >
      <span className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden />
        {label}
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
    const allowed = projectReady && modeConfig.allowedAnnotateKinds.has(kind);
    return (
      <button
        key={kind}
        type="button"
        title={label}
        disabled={!allowed}
        className={`inline-flex h-9 flex-1 items-center justify-center gap-1 border border-ds-border/50 text-xs ${
          !allowed
            ? "cursor-not-allowed opacity-35"
            : annotateKind === kind
              ? "border-ds-success/80 bg-ds-success/15"
              : "hover:bg-ds-primary/40"
        }`}
        onClick={() => allowed && onAnnotateKindChange(kind)}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
      </button>
    );
  };

  const modeEntries = (Object.keys(MODES) as BuilderSemanticMode[]).map((k) => ({ key: k, cfg: MODES[k] }));

  const panelTitle = (t: string) => (
    <p className="border-b border-ds-border/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ds-muted">
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
    <aside className="flex w-[288px] shrink-0 flex-col overflow-y-auto border-r border-ds-border/80 bg-ds-secondary/20">
      {panelTitle("Graph & filters")}
      <div className="space-y-3 border-b border-ds-border/70 px-3 py-3">
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-ds-muted">Semantic mode</p>
          <select
            className="app-field min-h-9 w-full !py-1.5 !text-xs leading-snug"
            value={semanticMode}
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
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ds-muted">System layers</p>
            <div className="border border-ds-border/60">
              {sysRow("fiber", "Fiber", "bg-blue-500")}
              {sysRow("irrigation", "Irrigation", "bg-emerald-500")}
              {sysRow("electrical", "Electrical", "bg-amber-500")}
              {sysRow("telemetry", "Telemetry", "bg-slate-400")}
            </div>
          </div>
        ) : null}

        {modeConfig.ui.showInfrastructureFilters ? (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-ds-muted">Attribute filters</p>
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
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "h-8 min-w-[5.5rem] flex-1 text-xs")}
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
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ds-muted">Presets</p>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                <button type="button" className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "h-8 px-1 text-[11px] leading-tight")} onClick={onPresetAvailableFiber} title="strands_available &gt; 0">
                  Available fiber
                </button>
                <button type="button" className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "h-8 px-1 text-[11px] leading-tight")} onClick={onPresetNearCapacity} title="strands_available &lt; 2">
                  Near capacity
                </button>
                <button type="button" className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "h-8 px-1 text-[11px] leading-tight")} onClick={onPresetActiveOnly} title="status = active">
                  Active only
                </button>
              </div>
            </div>
            {filterRules.length > 0 ? (
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ds-muted">Active filters</p>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {filterRules.map((r, i) => (
                    <div
                      key={`${r.entity}-${r.key}-${i}`}
                      className="flex items-center justify-between gap-2 border border-ds-border/50 bg-ds-primary/15 px-2 py-1 text-[11px] text-ds-muted"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-semibold text-ds-foreground">{r.entity}</span> · {r.key} {r.operator}{" "}
                        <span className="font-semibold text-ds-foreground">{String(r.value)}</span>
                      </span>
                      <button type="button" className="shrink-0 px-1 text-xs hover:bg-ds-primary/40" onClick={() => onRemoveFilterRule(i)} aria-label="Remove filter">
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
            <p className="text-[10px] font-medium uppercase tracking-wide text-ds-muted">Trace route</p>
            <p className="text-[10px] leading-relaxed text-ds-muted">
              Pick a start asset, then an end asset on the map. Filters above constrain the graph used for routing.
            </p>
            <div className="space-y-1 rounded border border-ds-border/60 bg-ds-primary/15 px-2 py-1.5 text-[11px] text-ds-muted">
              <div>
                <span className="font-semibold text-ds-foreground">Start:</span>{" "}
                {traceStartLabel ?? (traceMode && !traceStartId ? "…pick on map" : "—")}
              </div>
              <div>
                <span className="font-semibold text-ds-foreground">End:</span>{" "}
                {traceEndLabel ?? (traceMode && traceStartId && !traceEndId ? "…pick on map" : "—")}
              </div>
            </div>
            <button
              type="button"
              className={`w-full py-2 text-xs font-semibold ${
                traceMode
                  ? "border border-ds-success bg-ds-success/20 text-ds-foreground"
                  : "border border-ds-border/70 bg-ds-primary/30 text-ds-foreground hover:bg-ds-primary/45"
              }`}
              disabled={!projectReady}
              onClick={() => projectReady && onTraceRoute()}
            >
              {traceMode ? "Tracing… (click to cancel)" : "Trace route"}
            </button>
            {traceResult ? (
              <div className="space-y-1 border border-ds-border/60 bg-ds-primary/20 px-2 py-2 text-[11px] text-ds-muted">
                <div>
                  Hops:{" "}
                  <span className="font-semibold text-ds-foreground">{Math.max(0, traceResult.asset_ids.length - 1)}</span>
                </div>
                {traceResult.reason ? <div className="font-semibold text-ds-warning">{traceResult.reason}</div> : null}
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
                    <p className="text-[10px] font-medium uppercase tracking-wide text-ds-muted">Default system</p>
                    <select
                      className="app-field min-h-9 w-full !py-1.5 !text-xs leading-snug"
                      value={defaultSystemType}
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
                    Mode <span className="font-semibold text-ds-foreground">{modeConfig.label}</span> uses{" "}
                    <span className="font-semibold text-ds-foreground">{modeConfig.defaultSystemType}</span> for new elements.
                  </p>
                )}
                {primaryMode === "add_asset" && projectReady ? (
                  <div>
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-ds-muted">Asset type</p>
                    <div className="grid grid-cols-3 gap-1 border border-ds-border/60 p-2">
                      <button
                        type="button"
                        title="Building footprint"
                        className={`inline-flex h-10 items-center justify-center border text-xs ${
                          assetShape === "rectangle" ? "border-ds-success bg-ds-success/15" : "border-transparent hover:bg-ds-primary/40"
                        }`}
                        onClick={() => onAssetShapeChange("rectangle")}
                      >
                        <Square className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Node / junction"
                        className={`inline-flex h-10 items-center justify-center border text-xs ${
                          assetShape === "ellipse" ? "border-ds-success bg-ds-success/15" : "border-transparent hover:bg-ds-primary/40"
                        }`}
                        onClick={() => onAssetShapeChange("ellipse")}
                      >
                        <CircleIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Custom area"
                        className={`inline-flex h-10 items-center justify-center border text-xs ${
                          assetShape === "polygon" ? "border-ds-success bg-ds-success/15" : "border-transparent hover:bg-ds-primary/40"
                        }`}
                        onClick={() => onAssetShapeChange("polygon")}
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
                        className={`px-2 py-2 text-xs font-semibold ${connectFlow === "pick" ? "bg-ds-success/20 text-ds-foreground" : "text-ds-muted hover:bg-ds-primary/40"}`}
                        onClick={() => onConnectFlowChange("pick")}
                      >
                        Pick 2 assets
                      </button>
                      <button
                        type="button"
                        className={`px-2 py-2 text-xs font-semibold ${connectFlow === "draw" ? "bg-ds-success/20 text-ds-foreground" : "text-ds-muted hover:bg-ds-primary/40"}`}
                        onClick={() => onConnectFlowChange("draw")}
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
                Door placement is not enabled here yet. When available, door segments will snap to wall geometry like the blueprint designer.
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
                <p className="text-[10px] text-ds-muted">Blueprint overlays only — not written to the infrastructure graph.</p>
              </>
            ) : null}

            {activeTool === "trace" ? (
              <div className="space-y-2 text-[11px] text-ds-muted">
                <p>Use the Trace route section above for start/end and results. The rail keeps trace mode in sync with the map.</p>
                {traceResult ? (
                  <p>
                    Route length: <span className="font-semibold text-ds-foreground">{traceResult.asset_ids.length}</span> assets
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
