"use client";

import {
  MapPin,
  MousePointer2,
  PenLine,
  Route,
  Square,
  Circle as CircleIcon,
  Hexagon,
  Building2,
  Spline,
  StickyNote,
  Pencil,
  Type,
} from "lucide-react";
import { useState } from "react";
import type { FilterRule, SystemType } from "../utils/graphHelpers";
import type { AnnotateKind, AssetDrawShape, ConnectFlow, PrimaryMode } from "../mapBuilderTypes";
import type { BuilderSemanticMode, MapModeConfig } from "../mapBuilderModes";
import { MODES } from "../mapBuilderModes";

export function Sidebar({
  projectReady = true,
  semanticMode,
  onSemanticModeChange,
  modeConfig,
  activeSystems,
  onToggleSystem,
  primaryMode,
  onPrimaryModeChange,
  assetShape,
  onAssetShapeChange,
  connectFlow,
  onConnectFlowChange,
  annotateKind,
  onAnnotateKindChange,
  defaultSystemType,
  onDefaultSystemTypeChange,
  onTraceRoute,
  traceActive,
  filterRules,
  onAddFilterRule,
  onRemoveFilterRule,
  onPresetAvailableFiber,
}: {
  activeSystems: Record<SystemType, boolean>;
  onToggleSystem: (s: SystemType) => void;
  primaryMode: PrimaryMode;
  onPrimaryModeChange: (m: PrimaryMode) => void;
  assetShape: AssetDrawShape;
  onAssetShapeChange: (s: AssetDrawShape) => void;
  connectFlow: ConnectFlow;
  onConnectFlowChange: (f: ConnectFlow) => void;
  annotateKind: AnnotateKind;
  onAnnotateKindChange: (k: AnnotateKind) => void;
  defaultSystemType: SystemType;
  onDefaultSystemTypeChange: (s: SystemType) => void;
  onTraceRoute: () => void;
  traceActive: boolean;
  filterRules: FilterRule[];
  onAddFilterRule: (r: FilterRule) => void;
  onRemoveFilterRule: (idx: number) => void;
  onPresetAvailableFiber: () => void;
  /** When false, creation tools (assets, connections, zones, annotate, trace) are disabled. */
  projectReady?: boolean;
  semanticMode: BuilderSemanticMode;
  onSemanticModeChange: (m: BuilderSemanticMode) => void;
  modeConfig: MapModeConfig;
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
      className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-ds-foreground hover:bg-ds-primary/50"
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

  const modeBtn = (id: PrimaryMode, label: string, Icon: typeof MousePointer2) => {
    const allowed =
      modeConfig.allowedPrimaryModes.has(id) && (id === "select" || projectReady);
    return (
      <button
        key={id}
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={primaryMode === id}
        disabled={!allowed}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
          !allowed
            ? "cursor-not-allowed opacity-35"
            : primaryMode === id
              ? "border-ds-success bg-ds-success/15 text-ds-foreground"
              : "border-transparent bg-transparent text-ds-muted hover:border-ds-border hover:bg-ds-primary/40 hover:text-ds-foreground"
        }`}
        onClick={() => allowed && onPrimaryModeChange(id)}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </button>
    );
  };

  const annotateBtn = (kind: AnnotateKind, label: string, Icon: typeof StickyNote) => {
    const allowed = projectReady && modeConfig.allowedAnnotateKinds.has(kind);
    return (
      <button
        key={kind}
        type="button"
        title={label}
        disabled={!allowed}
        className={`inline-flex h-9 items-center justify-center gap-1 rounded-md border text-xs ${
          !allowed
            ? "cursor-not-allowed opacity-35"
            : annotateKind === kind
              ? "border-ds-success bg-ds-success/15"
              : "border-transparent hover:bg-ds-primary/40"
        }`}
        onClick={() => allowed && onAnnotateKindChange(kind)}
      >
        <Icon className="h-4 w-4 shrink-0" /> {label.replace(/\s*\(.*\)/, "")}
      </button>
    );
  };

  const modeEntries = (Object.keys(MODES) as BuilderSemanticMode[]).map((key) => ({ key, cfg: MODES[key] }));

  return (
    <aside className="w-[252px] shrink-0 border-r border-ds-border/70 bg-ds-secondary/20 p-2">
      <div className="space-y-3">
        <section className="space-y-1.5">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Semantic mode</p>
          <p className="px-1 text-[10px] leading-snug text-ds-muted">Switches tools and graph presentation — same engine, different configuration.</p>
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
        </section>

        {modeConfig.ui.showSystemLayerToggles ? (
          <section className="space-y-1.5">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Layers</p>
            <div className="space-y-0.5">
              {sysRow("fiber", "Fiber", "bg-blue-500")}
              {sysRow("irrigation", "Irrigation", "bg-emerald-500")}
              {sysRow("electrical", "Electrical", "bg-amber-500")}
              {sysRow("telemetry", "Telemetry", "bg-slate-400")}
            </div>
          </section>
        ) : null}

        {modeConfig.ui.showDefaultSystemPicker ? (
          <section className="space-y-1.5">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Default system</p>
            <p className="px-1 text-[10px] leading-snug text-ds-muted">New assets & connections use this system unless changed in the inspector.</p>
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
          </section>
        ) : (
          <p className="px-1 text-[10px] leading-snug text-ds-muted">
            Mode <span className="font-semibold text-ds-foreground">{modeConfig.label}</span> uses system{" "}
            <span className="font-semibold text-ds-foreground">{modeConfig.defaultSystemType}</span> for new graph elements.
          </p>
        )}

        {modeConfig.ui.showInfrastructureFilters ? (
          <section className="space-y-1.5">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Filters</p>
          <div className="rounded-md border border-ds-border/70 bg-ds-primary/25 p-2">
            <div className="grid grid-cols-2 gap-1.5">
              <select className="app-field min-h-9 !py-1.5 !text-xs leading-snug" value={entity} onChange={(e) => setEntity(e.target.value as "asset" | "connection")}>
                <option value="asset">Asset</option>
                <option value="connection">Connection</option>
              </select>
              <select className="app-field min-h-9 !py-1.5 !text-xs leading-snug" value={operator} onChange={(e) => setOperator(e.target.value as FilterRule["operator"])}>
                <option value="equals">=</option>
                <option value="not_equals">≠</option>
                <option value="gt">&gt;</option>
                <option value="lt">&lt;</option>
                <option value="contains">contains</option>
              </select>
              <input className="app-field min-h-9 !py-1.5 !text-xs leading-snug" placeholder="key" value={key} onChange={(e) => setKey(e.target.value)} />
              <input className="app-field min-h-9 !py-1.5 !text-xs leading-snug" placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="mt-2 flex items-center gap-2">
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
                Add Filter
              </button>
              <button type="button" className="ds-btn-secondary h-8 text-xs" onClick={onPresetAvailableFiber} title="Available Fiber">
                Preset
              </button>
            </div>
          </div>
          {filterRules.length > 0 ? (
            <div className="mt-2 space-y-1">
              {filterRules.map((r, i) => (
                <div
                  key={`${r.entity}-${r.key}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-ds-border/70 bg-ds-primary/15 px-2 py-1 text-[11px] text-ds-muted"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-semibold text-ds-foreground">{r.entity}</span> · {r.key} {r.operator}{" "}
                    <span className="font-semibold text-ds-foreground">{String(r.value)}</span>
                  </span>
                  <button type="button" className="shrink-0 rounded px-1 text-xs hover:bg-ds-primary/40" onClick={() => onRemoveFilterRule(i)} aria-label="Remove filter">
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          </section>
        ) : null}

        <section className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Map tools</p>
            {modeConfig.ui.showTraceRoute ? (
              <button
                type="button"
                title="Trace route"
                aria-label="Trace route"
                disabled={!projectReady}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                  !projectReady
                    ? "cursor-not-allowed opacity-35"
                    : traceActive
                      ? "border-ds-success bg-ds-success/15 text-ds-foreground"
                      : "border-transparent bg-transparent text-ds-muted hover:border-ds-border hover:bg-ds-primary/40 hover:text-ds-foreground"
                }`}
                onClick={() => projectReady && onTraceRoute()}
              >
                <Route className="h-4.5 w-4.5" aria-hidden />
              </button>
            ) : (
              <span className="text-[10px] text-ds-muted"> </span>
            )}
          </div>

          <p className="px-1 text-[10px] leading-snug text-ds-muted">Choose intent first; drawing creates structured infrastructure data.</p>

          <div className="grid grid-cols-5 gap-1">
            {modeBtn("select", "Select", MousePointer2)}
            {modeBtn("add_asset", "Add asset", Building2)}
            {modeBtn("connect", "Connect", Spline)}
            {modeBtn("add_zone", "Add zone", MapPin)}
            {modeBtn("annotate", "Annotate", PenLine)}
          </div>

          {primaryMode === "add_asset" ? (
            <div className="rounded-md border border-ds-border/60 bg-ds-primary/20 px-2 py-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Placement</p>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  title="Building footprint"
                  className={`inline-flex h-9 items-center justify-center rounded-md border text-xs ${assetShape === "rectangle" ? "border-ds-success bg-ds-success/15" : "border-transparent hover:bg-ds-primary/40"}`}
                  onClick={() => onAssetShapeChange("rectangle")}
                >
                  <Square className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Node / junction"
                  className={`inline-flex h-9 items-center justify-center rounded-md border text-xs ${assetShape === "ellipse" ? "border-ds-success bg-ds-success/15" : "border-transparent hover:bg-ds-primary/40"}`}
                  onClick={() => onAssetShapeChange("ellipse")}
                >
                  <CircleIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Custom area"
                  className={`inline-flex h-9 items-center justify-center rounded-md border text-xs ${assetShape === "polygon" ? "border-ds-success bg-ds-success/15" : "border-transparent hover:bg-ds-primary/40"}`}
                  onClick={() => onAssetShapeChange("polygon")}
                >
                  <Hexagon className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-ds-muted">Rectangle → building · Circle → node · Polygon → area (click vertices, click near start to close)</p>
            </div>
          ) : null}

          {primaryMode === "connect" ? (
            <div className="rounded-md border border-ds-border/60 bg-ds-primary/20 px-2 py-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Connection</p>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  className={`rounded-md px-2 py-1.5 text-xs font-semibold ${connectFlow === "pick" ? "bg-ds-success/20 text-ds-foreground" : "text-ds-muted hover:bg-ds-primary/40"}`}
                  onClick={() => onConnectFlowChange("pick")}
                >
                  Pick 2 assets
                </button>
                <button
                  type="button"
                  className={`rounded-md px-2 py-1.5 text-xs font-semibold ${connectFlow === "draw" ? "bg-ds-success/20 text-ds-foreground" : "text-ds-muted hover:bg-ds-primary/40"}`}
                  onClick={() => onConnectFlowChange("draw")}
                >
                  Draw connection
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-ds-muted">
                Pick two assets, or draw a line whose endpoints snap to assets.
                {!modeConfig.interaction.snapConnectPreviewToAssets ? " Preview follows the cursor without magnet snap." : ""}
              </p>
            </div>
          ) : null}

          {primaryMode === "add_zone" ? (
            <div className="rounded-md border border-ds-border/60 bg-ds-primary/20 px-2 py-2">
              <p className="text-[10px] text-ds-muted">Click vertices for the zone polygon; click near the first point to close. Zones are for grouping and visuals (not graph edges).</p>
            </div>
          ) : null}

          {primaryMode === "annotate" ? (
            <div className="rounded-md border border-ds-border/60 bg-ds-primary/20 px-2 py-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Overlay</p>
              <div className="grid grid-cols-2 gap-1">
                {annotateBtn("symbol", "Symbol", StickyNote)}
                {annotateBtn("text", "Text", Type)}
                {annotateBtn("sketch", "Region", Pencil)}
                {annotateBtn("pen", "Pen", PenLine)}
              </div>
              <p className="mt-1.5 text-[10px] text-ds-muted">Blueprint-only overlays — never added to the infrastructure graph.</p>
            </div>
          ) : null}

        </section>
      </div>
    </aside>
  );
}
