"use client";

import type { ComponentType } from "react";
import { Redo2, Undo2 } from "lucide-react";
import type { SpatialWorkspaceToolEntry } from "@/spatial-engine/workspace/types";
import { cn } from "@/lib/cn";

type Props = {
  tools: readonly SpatialWorkspaceToolEntry[];
  activeToolId: string;
  onToolChange: (toolId: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
};

/** Glassmorphism tool strip — floats over the canvas (Figma-style). */
export function AdvertisingFloatingToolbar({
  tools,
  activeToolId,
  onToolChange,
  onUndo,
  onRedo,
}: Props) {
  const navigation = tools.filter((t) => t.group === "navigation");
  const primary = tools.filter((t) => t.group === "primary");
  const utility = tools.filter((t) => t.group === "utility");

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-0.5 rounded-2xl border border-white/50 p-1",
        "bg-white/65 shadow-[0_8px_32px_rgba(15,23,42,0.12)] backdrop-blur-xl",
      )}
      role="toolbar"
      aria-label="Advertising editor tools"
    >
      <IconBtn icon={Undo2} label="Undo" onClick={onUndo} />
      <IconBtn icon={Redo2} label="Redo" onClick={onRedo} />
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
        "flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
        active ? "bg-sky-500/15 text-sky-800 shadow-sm" : "text-slate-600 hover:bg-white/70",
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
      className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-white/70 disabled:opacity-40"
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Divider() {
  return <div className="mx-0.5 h-5 w-px bg-slate-300/60" aria-hidden />;
}
