"use client";

import type { ComponentType } from "react";
import { Magnet, Minus, Plus, Redo2, Undo2 } from "lucide-react";
import type { SpatialWorkspaceToolEntry } from "@/spatial-engine/workspace/types";
import { cn } from "@/lib/cn";

type Props = {
  tools: readonly SpatialWorkspaceToolEntry[];
  activeToolId: string;
  onToolChange: (toolId: string) => void;
  snapEnabled: boolean;
  onSnapToggle: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  scalePercent?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  zoomDisabled?: boolean;
  /** `header` — top bar strip; `floating` — over canvas (fullscreen). */
  variant?: "header" | "floating";
};

export function AdvertisingFloatingToolbar({
  tools,
  activeToolId,
  onToolChange,
  snapEnabled,
  onSnapToggle,
  onUndo,
  onRedo,
  scalePercent = 100,
  onZoomIn,
  onZoomOut,
  zoomDisabled = false,
  variant = "header",
}: Props) {
  const navigation = tools.filter((t) => t.group === "navigation");
  const primary = tools.filter((t) => t.group === "primary");
  const utility = tools.filter((t) => t.group === "utility");

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white/95 p-1",
        variant === "floating" ? "shadow-lg backdrop-blur-sm" : "shadow-sm",
      )}
      role="toolbar"
      aria-label="Advertising editor tools"
    >
      <IconBtn icon={Undo2} label="Undo" onClick={onUndo} />
      <IconBtn icon={Redo2} label="Redo" onClick={onRedo} />
      <Divider />
      <button
        type="button"
        className={cn(
          "rounded-lg px-2.5 py-1.5 text-xs font-semibold",
          snapEnabled ? "bg-sky-50 text-sky-700" : "text-slate-500 hover:bg-slate-50",
        )}
        onClick={onSnapToggle}
      >
        <span className="flex items-center gap-1">
          <Magnet className="h-3.5 w-3.5" />
          Snapping {snapEnabled ? "ON" : "OFF"}
        </span>
      </button>
      <Divider />
      {navigation.map((tool) => (
        <ToolBtn key={tool.id} tool={tool} active={activeToolId === tool.id} onSelect={() => onToolChange(tool.id)} />
      ))}
      <Divider />
      {primary.map((tool) => (
        <ToolBtn key={tool.id} tool={tool} active={activeToolId === tool.id} onSelect={() => onToolChange(tool.id)} />
      ))}
      {utility.length > 0 ? <Divider /> : null}
      {utility.map((tool) => (
        <ToolBtn key={tool.id} tool={tool} active={activeToolId === tool.id} onSelect={() => onToolChange(tool.id)} />
      ))}
      <Divider />
      <div
        className={cn(
          "flex items-center rounded-lg border border-slate-200/80 bg-slate-50/90",
          zoomDisabled && "pointer-events-none opacity-50",
        )}
        role="group"
        aria-label="Zoom"
      >
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-white disabled:opacity-40"
          onClick={onZoomOut}
          disabled={zoomDisabled || !onZoomOut}
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-[3.25rem] border-x border-slate-200/80 px-2 text-center font-mono text-xs font-semibold text-slate-800">
          {scalePercent}%
        </span>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-white disabled:opacity-40"
          onClick={onZoomIn}
          disabled={zoomDisabled || !onZoomIn}
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ToolBtn({
  tool,
  active,
  onSelect,
}: {
  tool: SpatialWorkspaceToolEntry;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = tool.icon;
  const shortcut = tool.hotkeys?.[0]?.key?.toUpperCase();
  return (
    <button
      type="button"
      title={shortcut ? `${tool.label} (${shortcut})` : tool.label}
      aria-label={tool.label}
      aria-pressed={active}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
        active ? "bg-sky-100 text-sky-700" : "text-slate-600 hover:bg-slate-100",
      )}
      onClick={onSelect}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function IconBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Divider() {
  return <div className="mx-0.5 h-6 w-px bg-slate-200" aria-hidden />;
}
