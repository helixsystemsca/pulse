"use client";

import { Cable, Droplets, Zap, Radar, MousePointer2, PenTool, Plus, GitBranch, Route } from "lucide-react";
import { useState } from "react";
import type { FilterRule, SystemType } from "../utils/graphHelpers";

type ToolId = "select" | "draw" | "add_asset" | "connect";

export function Sidebar({
  activeSystems,
  onToggleSystem,
  tool,
  onToolChange,
  onTraceRoute,
  traceActive,
  filterRules,
  onAddFilterRule,
  onRemoveFilterRule,
  onPresetAvailableFiber,
}: {
  activeSystems: Record<SystemType, boolean>;
  onToggleSystem: (s: SystemType) => void;
  tool: ToolId;
  onToolChange: (t: ToolId) => void;
  onTraceRoute: () => void;
  traceActive: boolean;
  filterRules: FilterRule[];
  onAddFilterRule: (r: FilterRule) => void;
  onRemoveFilterRule: (idx: number) => void;
  onPresetAvailableFiber: () => void;
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

  const toolBtn = (id: ToolId, label: string, Icon: typeof MousePointer2) => (
    <button
      key={id}
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
        tool === id
          ? "border-ds-success bg-ds-success/15 text-ds-foreground"
          : "border-transparent bg-transparent text-ds-muted hover:border-ds-border hover:bg-ds-primary/40 hover:text-ds-foreground"
      }`}
      onClick={() => onToolChange(id)}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );

  return (
    <aside className="w-[252px] shrink-0 border-r border-ds-border/70 bg-ds-secondary/20 p-2">
      <div className="space-y-3">
        <section className="space-y-1.5">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Layers</p>
          <div className="space-y-0.5">
            {sysRow("fiber", "Fiber", "bg-blue-500")}
            {sysRow("irrigation", "Irrigation", "bg-emerald-500")}
            {sysRow("electrical", "Electrical", "bg-amber-500")}
            {sysRow("telemetry", "Telemetry", "bg-slate-400")}
          </div>
        </section>

        <section className="space-y-1.5">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Filters</p>
          <div className="rounded-md border border-ds-border/70 bg-ds-primary/25 p-2">
            <div className="grid grid-cols-2 gap-1.5">
              <select className="app-field h-8 text-xs" value={entity} onChange={(e) => setEntity(e.target.value as any)}>
                <option value="asset">Asset</option>
                <option value="connection">Connection</option>
              </select>
              <select className="app-field h-8 text-xs" value={operator} onChange={(e) => setOperator(e.target.value as any)}>
                <option value="equals">=</option>
                <option value="not_equals">≠</option>
                <option value="gt">&gt;</option>
                <option value="lt">&lt;</option>
                <option value="contains">contains</option>
              </select>
              <input className="app-field h-8 text-xs" placeholder="key" value={key} onChange={(e) => setKey(e.target.value)} />
              <input className="app-field h-8 text-xs" placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} />
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

        <section className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Tools</p>
            <button
              type="button"
              title="Trace route"
              aria-label="Trace route"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                traceActive
                  ? "border-ds-success bg-ds-success/15 text-ds-foreground"
                  : "border-transparent bg-transparent text-ds-muted hover:border-ds-border hover:bg-ds-primary/40 hover:text-ds-foreground"
              }`}
              onClick={onTraceRoute}
            >
              <Route className="h-4.5 w-4.5" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {toolBtn("select", "Select", MousePointer2)}
            {toolBtn("draw", "Draw shape (opens designer)", PenTool)}
            {toolBtn("add_asset", "Add asset", Plus)}
            {toolBtn("connect", "Connect", GitBranch)}
          </div>
          <div className="mt-1 grid grid-cols-4 gap-1 px-0.5">
            <span className="inline-flex items-center justify-center rounded-md bg-transparent text-[10px] text-ds-muted" title="Fiber">
              <Cable className="h-4 w-4" aria-hidden />
            </span>
            <span className="inline-flex items-center justify-center rounded-md bg-transparent text-[10px] text-ds-muted" title="Irrigation">
              <Droplets className="h-4 w-4" aria-hidden />
            </span>
            <span className="inline-flex items-center justify-center rounded-md bg-transparent text-[10px] text-ds-muted" title="Electrical">
              <Zap className="h-4 w-4" aria-hidden />
            </span>
            <span className="inline-flex items-center justify-center rounded-md bg-transparent text-[10px] text-ds-muted" title="Telemetry">
              <Radar className="h-4 w-4" aria-hidden />
            </span>
          </div>
        </section>
      </div>
    </aside>
  );
}

