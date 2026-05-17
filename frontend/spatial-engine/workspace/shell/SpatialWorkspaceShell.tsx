"use client";

import type { ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import type { SpatialWorkspaceId } from "@/spatial-engine/workspace/types";
import { getSpatialWorkspace } from "@/spatial-engine/workspace/registry";
import { SpatialToolRail } from "@/spatial-engine/workspace/shell/SpatialToolRail";
import { cn } from "@/lib/cn";

export type SpatialWorkspaceShellProps = {
  workspaceId: SpatialWorkspaceId;
  title: string;
  subtitle?: string;
  activeToolId: string;
  onToolChange: (toolId: string) => void;
  toolsDisabled?: boolean;
  toolsDisabledReason?: string;
  /** Override registry tools (e.g. per-tool disabled flags from domain state). */
  tools?: ReturnType<typeof getSpatialWorkspace>["tools"];
  headerActions?: ReactNode;
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  viewport: ReactNode;
  floatingControls?: ReactNode;
  minimap?: ReactNode;
  statusHint?: ReactNode;
  banner?: ReactNode;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  immersive?: boolean;
  className?: string;
};

export function SpatialWorkspaceShell({
  workspaceId,
  title,
  subtitle,
  activeToolId,
  onToolChange,
  toolsDisabled,
  toolsDisabledReason,
  tools: toolsOverride,
  headerActions,
  leftPanel,
  rightPanel,
  viewport,
  floatingControls,
  minimap,
  statusHint,
  banner,
  fullscreen = false,
  onToggleFullscreen,
  immersive = true,
  className,
}: SpatialWorkspaceShellProps) {
  const workspace = getSpatialWorkspace(workspaceId);
  const tools = toolsOverride ?? workspace.tools;
  const showLeft = workspace.sidePanels.includes("left") && leftPanel;
  const showRight = workspace.sidePanels.includes("right") && rightPanel;

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-col overflow-hidden bg-ds-bg font-manrope",
        immersive && "h-[calc(100dvh-3.5rem)]",
        fullscreen && "h-full",
        className,
      )}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-ds-border/80 bg-ds-primary/90 px-3 py-2 backdrop-blur-sm">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold uppercase tracking-wide text-ds-muted">{workspace.label}</p>
          <h1 className="truncate text-sm font-semibold text-ds-foreground">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-ds-muted">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerActions}
          {onToggleFullscreen ? (
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-ds-border text-ds-muted hover:bg-ds-secondary hover:text-ds-foreground"
              onClick={onToggleFullscreen}
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
      </header>

      {banner}

      <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
        <SpatialToolRail
          tools={tools}
          activeToolId={activeToolId}
          onToolChange={onToolChange}
          disabled={toolsDisabled}
          disabledReason={toolsDisabledReason}
          ariaLabel={`${workspace.label} tools`}
        />

        {showLeft ? (
          <aside className="flex w-[220px] shrink-0 flex-col overflow-y-auto border-r border-ds-border/80 bg-ds-secondary/20">
            {leftPanel}
          </aside>
        ) : null}

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#eef1f5] dark:bg-ds-primary">
          <div className="relative min-h-0 flex-1">{viewport}</div>
          {floatingControls ? (
            <div className="pointer-events-none absolute right-3 top-3 z-30">{floatingControls}</div>
          ) : null}
          {minimap ? <div className="pointer-events-none absolute bottom-3 left-3 z-30">{minimap}</div> : null}
          {statusHint ? (
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 max-w-lg -translate-x-1/2 px-3">{statusHint}</div>
          ) : null}
        </main>

        {showRight ? (
          <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-ds-border/80 bg-ds-primary/95">
            {rightPanel}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
