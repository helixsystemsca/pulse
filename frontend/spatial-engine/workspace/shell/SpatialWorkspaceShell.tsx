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
  /** Centered header content (editor workspaces: view title + tool strip). */
  headerCenter?: ReactNode;
  workspaceSwitcher?: ReactNode;
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  viewport: ReactNode;
  floatingControls?: ReactNode;
  minimap?: ReactNode;
  statusHint?: ReactNode;
  banner?: ReactNode;
  /** Centered toolbar above the canvas (editor workspaces). */
  floatingToolbar?: ReactNode;
  /** Distance from top of main viewport to floating toolbar (clears rulers). */
  floatingToolbarInsetTop?: number;
  /** Footer strip (e.g. wall switcher). */
  bottomBar?: ReactNode;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  immersive?: boolean;
  /**
   * Editor-only: hide title header and footer strip (fullscreen tab with tool rail + canvas only).
   */
  bareEditor?: boolean;
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
  headerCenter,
  workspaceSwitcher,
  leftPanel,
  rightPanel,
  viewport,
  floatingControls,
  minimap,
  statusHint,
  banner,
  floatingToolbar,
  floatingToolbarInsetTop,
  bottomBar,
  fullscreen = false,
  onToggleFullscreen,
  immersive = true,
  bareEditor = false,
  className,
}: SpatialWorkspaceShellProps) {
  const workspace = getSpatialWorkspace(workspaceId);
  const tools = toolsOverride ?? workspace.tools;
  const layout = workspace.layout;
  const editorChrome = layout?.chrome === "editor";
  const hideToolRail = layout?.hideToolRail ?? false;
  const rightWidth = layout?.rightPanelWidthPx ?? 300;
  const showLeft = workspace.sidePanels.includes("left") && leftPanel;
  const showRight = workspace.sidePanels.includes("right") && rightPanel;

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-col overflow-hidden font-manrope",
        editorChrome ? "bg-[#f4f6f9]" : "bg-ds-bg",
        immersive && "h-[calc(100dvh-3.5rem)]",
        fullscreen && "h-full",
        className,
      )}
    >
      {!bareEditor ? (
        <header
          className={cn(
            "flex shrink-0 border-b px-3 backdrop-blur-sm",
            headerCenter && editorChrome
              ? "grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2"
              : "flex items-center gap-3",
            editorChrome
              ? "border-slate-200/90 bg-white/95 shadow-sm"
              : "border-ds-border/80 bg-ds-primary/90 py-2",
            !(headerCenter && editorChrome) && editorChrome && "py-1.5",
          )}
        >
          <div className="flex min-w-0 items-center gap-2 justify-self-start">
            {workspaceSwitcher ? <div className="shrink-0">{workspaceSwitcher}</div> : null}
            {headerCenter && editorChrome ? (
              <div className="min-w-0">
                <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{workspace.label}</p>
                <h1 className="truncate text-xs font-semibold text-slate-700">{title}</h1>
                {subtitle ? <p className="truncate text-[10px] text-slate-500">{subtitle}</p> : null}
              </div>
            ) : null}
          </div>

          {headerCenter && editorChrome ? (
            <div className="flex flex-col items-center justify-center gap-1.5 justify-self-center">{headerCenter}</div>
          ) : (
            <div className="min-w-0 flex-1">
              {!editorChrome ? (
                <p className="truncate text-[10px] font-bold uppercase tracking-wide text-ds-muted">{workspace.label}</p>
              ) : null}
              <h1 className="truncate text-sm font-semibold text-ds-foreground">{title}</h1>
              {subtitle && !editorChrome ? <p className="truncate text-xs text-ds-muted">{subtitle}</p> : null}
            </div>
          )}

          <div className="flex shrink-0 items-center gap-2 justify-self-end">
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
      ) : null}

      {banner}

      <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
        {!hideToolRail ? (
          <div className="z-10 shrink-0 overflow-visible">
            <SpatialToolRail
              tools={tools}
              activeToolId={activeToolId}
              onToolChange={onToolChange}
              disabled={toolsDisabled}
              disabledReason={toolsDisabledReason}
              ariaLabel={`${workspace.label} tools`}
            />
          </div>
        ) : null}

        {showLeft ? (
          <aside className="flex w-[220px] shrink-0 flex-col overflow-y-auto border-r border-ds-border/80 bg-ds-secondary/20">
            {leftPanel}
          </aside>
        ) : null}

        <main
          className={cn(
            "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            editorChrome ? "bg-[#e8ecf1]" : "bg-[#eef1f5] dark:bg-ds-primary",
          )}
        >
          {floatingToolbar ? (
            <div
              className="pointer-events-none absolute left-1/2 z-40 -translate-x-1/2"
              style={{ top: floatingToolbarInsetTop ?? (editorChrome ? 44 : 12) }}
            >
              {floatingToolbar}
            </div>
          ) : null}
          <div className="relative min-h-0 flex-1">{viewport}</div>
          {floatingControls ? (
            <div
              className={cn(
                "pointer-events-none absolute z-30 right-3",
                bottomBar
                  ? "bottom-[7.25rem] sm:bottom-[6.25rem]"
                  : editorChrome
                    ? "bottom-3"
                    : "top-3",
              )}
            >
              {floatingControls}
            </div>
          ) : null}
          {minimap ? (
            <div
              className={cn(
                "pointer-events-none absolute z-30 left-3",
                bottomBar ? "bottom-[8.5rem] sm:bottom-[7.5rem]" : editorChrome ? "bottom-14" : "bottom-3",
              )}
            >
              {minimap}
            </div>
          ) : null}
          {statusHint ? (
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 max-w-lg -translate-x-1/2 px-3">{statusHint}</div>
          ) : null}
          {bottomBar && !bareEditor ? (
            <div className="shrink-0 border-t border-slate-200/90 bg-white/95">{bottomBar}</div>
          ) : null}
        </main>

        {showRight ? (
          <aside
            style={{ width: rightWidth }}
            className={cn(
              "flex shrink-0 flex-col overflow-hidden border-l",
              editorChrome ? "border-slate-200/90 bg-white" : "border-ds-border/80 bg-ds-primary/95",
            )}
          >
            {rightPanel}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
