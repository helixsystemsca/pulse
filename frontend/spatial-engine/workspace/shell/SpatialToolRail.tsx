"use client";

import type { SpatialWorkspaceToolEntry } from "@/spatial-engine/workspace/types";
import { cn } from "@/lib/cn";

const BTN =
  "relative mx-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-35";

type Props = {
  tools: readonly SpatialWorkspaceToolEntry[];
  activeToolId: string;
  onToolChange: (toolId: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  ariaLabel?: string;
};

export function SpatialToolRail({
  tools,
  activeToolId,
  onToolChange,
  disabled = false,
  disabledReason,
  ariaLabel = "Spatial tools",
}: Props) {
  const navigation = tools.filter((t) => t.group === "navigation");
  const primary = tools.filter((t) => t.group === "primary");
  const utility = tools.filter((t) => t.group === "utility");

  return (
    <nav
      className="flex w-11 shrink-0 flex-col border-r border-ds-border/80 bg-ds-secondary/40 py-2 dark:bg-ds-secondary/30"
      aria-label={ariaLabel}
    >
      {navigation.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          active={activeToolId === tool.id}
          disabled={disabled || tool.disabled}
          disabledReason={tool.disabledReason ?? disabledReason}
          onSelect={() => onToolChange(tool.id)}
        />
      ))}

      {primary.length > 0 ? <RailDivider /> : null}

      {primary.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          active={activeToolId === tool.id}
          disabled={disabled || tool.disabled}
          disabledReason={tool.disabledReason ?? disabledReason}
          onSelect={() => onToolChange(tool.id)}
        />
      ))}

      <div className="min-h-2 flex-1" aria-hidden />

      {utility.length > 0 ? <RailDivider /> : null}
      {utility.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          active={activeToolId === tool.id}
          disabled={disabled || tool.disabled}
          disabledReason={tool.disabledReason ?? disabledReason}
          onSelect={() => onToolChange(tool.id)}
        />
      ))}
    </nav>
  );
}

function ToolButton({
  tool,
  active,
  disabled,
  disabledReason,
  onSelect,
}: {
  tool: SpatialWorkspaceToolEntry;
  active: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: () => void;
}) {
  const Icon = tool.icon;
  const shortcut = tool.hotkeys?.[0]?.key?.toUpperCase();
  const title = disabled && disabledReason ? disabledReason : shortcut ? `${tool.label} (${shortcut})` : tool.label;

  return (
    <button
      type="button"
      title={title}
      aria-label={tool.label}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        BTN,
        active
          ? "bg-[var(--ds-accent)]/15 text-[var(--ds-accent)] before:absolute before:left-0 before:top-1/2 before:h-[18px] before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-[var(--ds-accent)]"
          : "text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground",
      )}
      onClick={() => !disabled && onSelect()}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

function RailDivider() {
  return <div className="mx-auto my-1.5 h-px w-6 shrink-0 bg-ds-border/60" aria-hidden />;
}
