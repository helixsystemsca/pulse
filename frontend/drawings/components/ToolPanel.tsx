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
import type { FilterRule, SystemType, TraceRouteResult } from "../utils/graphHelpers";
import type { AnnotateKind, AssetDrawShape, ConnectFlow, PrimaryMode } from "../mapBuilderTypes";
import type { BuilderSemanticMode, MapModeConfig } from "../mapBuilderModes";
import { MODES } from "../mapBuilderModes";
import type { WorkspaceTool } from "../workspaceTools";

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
  traceMode,
  traceStartId,
  traceResult,
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
  traceMode: boolean;
  traceStartId: string | null;
  traceResult: TraceRouteResult | null;
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

  return (
    <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-r border-ds-border/80 bg-ds-secondary/20">
      {activeTool === "select" ? (
        <>
          {panelTitle("Workspace")}
          <div className="space-y-3 px-3 py-3">
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
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ds-muted">Layers</p>
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
                <p className="text-[10px] font-medium uppercase tracking-wide text-ds-muted">Filters</p>
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="ds-btn-secondary h-8 flex-1 text-xs"
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
                    <button type="button" className="ds-btn-secondary h-8 text-xs" onClick={onPresetAvailableFiber} title="Available fiber">
                      Preset
                    </button>
                  </div>
                </div>
                {filterRules.length > 0 ? (
                  <div className="space-y-1">
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
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {activeTool === "asset" ? (
        <>
          {panelTitle("Asset")}
          <div className="space-y-3 px-3 py-3">
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
                <p className="text-[10px] text-ds-muted">New assets & connections use this system unless changed in the inspector.</p>
              </div>
            ) : (
              <p className="text-[10px] text-ds-muted">
                Mode <span className="font-semibold text-ds-foreground">{modeConfig.label}</span> uses system{" "}
                <span className="font-semibold text-ds-foreground">{modeConfig.defaultSystemType}</span> for new graph elements.
              </p>
            )}

            {primaryMode === "add_asset" && projectReady ? (
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-ds-muted">Placement shape</p>
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
                <p className="mt-2 text-[10px] text-ds-muted">
                  Rectangle → building · Circle → node · Polygon → area (vertices, close near start).
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-ds-muted">Choose rectangle, ellipse, or polygon, then draw on the map.</p>
            )}
          </div>
        </>
      ) : null}

      {activeTool === "connect" ? (
        <>
          {panelTitle("Connect")}
          <div className="space-y-3 px-3 py-3">
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
                    Draw connection
                  </button>
                </div>
                <p className="text-[10px] leading-relaxed text-ds-muted">
                  Pick two assets, or draw a line whose endpoints snap to assets when snapping is enabled.
                  {!modeConfig.interaction.snapConnectPreviewToAssets ? " Preview follows the cursor without magnet snap." : ""}
                </p>
              </>
            ) : (
              <p className="text-[10px] text-ds-muted">Select Connect on the rail, then pick or draw a connection on the map.</p>
            )}
          </div>
        </>
      ) : null}

      {activeTool === "zone" ? (
        <>
          {panelTitle("Zone")}
          <div className="px-3 py-3">
            <p className="text-xs leading-relaxed text-ds-muted">
              Click vertices for the zone polygon; click near the first point to close. Zones group areas visually (not graph edges).
            </p>
          </div>
        </>
      ) : null}

      {activeTool === "door" ? (
        <>
          {panelTitle("Door")}
          <div className="px-3 py-3">
            <p className="text-xs leading-relaxed text-ds-muted">
              Door placement is not available in this workspace. Edit doors in the blueprint designer when supported.
            </p>
          </div>
        </>
      ) : null}

      {activeTool === "annotate" ? (
        <>
          {panelTitle("Annotate")}
          <div className="space-y-2 px-3 py-3">
            <div className="grid grid-cols-2 gap-1">
              {annotateBtn("symbol", "Symbol", StickyNote)}
              {annotateBtn("text", "Text", Type)}
              {annotateBtn("sketch", "Region", Pencil)}
              {annotateBtn("pen", "Pen", PenLine)}
            </div>
            <p className="text-[10px] text-ds-muted">Blueprint-only overlays — not added to the infrastructure graph.</p>
          </div>
        </>
      ) : null}

      {activeTool === "trace" ? (
        <>
          {panelTitle("Trace route")}
          <div className="space-y-2 px-3 py-3">
            <p className="text-xs leading-relaxed text-ds-muted">
              {traceMode
                ? traceStartId
                  ? "Pick the end asset to complete the route."
                  : "Pick the start asset."
                : "Enable trace from the rail, then pick start and end assets on the map."}
            </p>
            {traceResult ? (
              <div className="border border-ds-border/60 bg-ds-primary/15 px-2 py-1.5 text-[11px] text-ds-muted">
                Hops:{" "}
                <span className="font-semibold text-ds-foreground">{Math.max(0, traceResult.asset_ids.length - 1)}</span>
                {traceResult.reason ? (
                  <span className="mt-1 block font-semibold text-ds-warning">{traceResult.reason}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </aside>
  );
}
