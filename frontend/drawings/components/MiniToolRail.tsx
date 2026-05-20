"use client";

import {
  Building2,
  DoorClosed,
  Hand,
  Layers,
  MapPin,
  MousePointer2,
  PenLine,
  Route,
  Spline,
} from "lucide-react";
import type { WorkspaceTool } from "../workspaceTools";

const BTN =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-l-[3px] border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-35";

type Item = { tool: WorkspaceTool; label: string; Icon: typeof MousePointer2; disabled?: boolean };

export function MiniToolRail({
  activeTool,
  onToolChange,
  traceAllowed,
  apiConnected,
  toolsLocked,
  toolsLockedHint,
  canvasNavMode,
  onCanvasSelectMode,
  onCanvasPanMode,
}: {
  activeTool: WorkspaceTool;
  onToolChange: (tool: WorkspaceTool) => void;
  traceAllowed: boolean;
  apiConnected: boolean;
  toolsLocked: boolean;
  toolsLockedHint: string;
  canvasNavMode: "select" | "pan";
  onCanvasSelectMode: () => void;
  onCanvasPanMode: () => void;
}) {
  const items: Item[] = [
    { tool: "asset", label: "Add asset", Icon: Building2 },
    { tool: "connect", label: "Connect", Icon: Spline },
    { tool: "zone", label: "Zone", Icon: MapPin },
    { tool: "door", label: "Door", Icon: DoorClosed, disabled: true },
    { tool: "annotate", label: "Annotate", Icon: PenLine },
    {
      tool: "trace",
      label: "Trace route",
      Icon: Route,
      disabled: !traceAllowed || !apiConnected || toolsLocked,
    },
  ];

  const navLocked = toolsLocked;
  const navTitle = navLocked ? toolsLockedHint : undefined;

  return (
    <nav
      className="flex w-12 shrink-0 flex-col overflow-visible border-r border-[#e2e6ec] bg-white px-1 py-2.5 dark:border-ds-border/80 dark:bg-ds-secondary/30"
      aria-label="Map tools"
    >
      <button
        type="button"
        title={navTitle ?? "Select — click assets, zones, and connections"}
        aria-label="Select"
        aria-pressed={canvasNavMode === "select"}
        disabled={navLocked}
        className={`${BTN} relative mx-auto ${
          canvasNavMode === "select"
            ? "bg-[#e6faf5] text-[#0fa07e] dark:bg-emerald-950/40 dark:text-emerald-200"
            : "text-[#96a0b0] hover:bg-ds-interactive-hover hover:text-[#1a2030] dark:text-ds-muted dark:hover:bg-ds-interactive-hover dark:hover:text-ds-foreground"
        } ${canvasNavMode === "select" ? "border-l-[#1ec8a0] pl-0.5" : ""}`}
        onClick={() => !navLocked && onCanvasSelectMode()}
      >
        <MousePointer2 className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        title={navTitle ?? "Pan — drag to move the map"}
        aria-label="Pan"
        aria-pressed={canvasNavMode === "pan"}
        disabled={navLocked}
        className={`${BTN} relative mx-auto mt-0.5 ${
          canvasNavMode === "pan"
            ? "bg-[#e6faf5] text-[#0fa07e] dark:bg-emerald-950/40 dark:text-emerald-200"
            : "text-[#96a0b0] hover:bg-ds-interactive-hover hover:text-[#1a2030] dark:text-ds-muted dark:hover:bg-ds-interactive-hover dark:hover:text-ds-foreground"
        } ${canvasNavMode === "pan" ? "border-l-[#1ec8a0] pl-0.5" : ""}`}
        onClick={() => !navLocked && onCanvasPanMode()}
      >
        <Hand className="h-4 w-4" aria-hidden />
      </button>

      <div className="mx-auto my-1 h-px w-[22px] shrink-0 bg-[#e2e6ec] dark:bg-ds-border/50" aria-hidden />

      {items.map(({ tool, label, Icon, disabled }) => {
        const on = activeTool === tool;
        const locked = toolsLocked && tool !== "door";
        const effectiveDisabled = Boolean(disabled) || locked;
        const title = locked ? toolsLockedHint : label;
        return (
          <button
            key={tool}
            type="button"
            title={title}
            aria-label={label}
            aria-pressed={on}
            disabled={effectiveDisabled}
            className={`${BTN} relative mx-auto mt-0.5 ${
              on
                ? "border-l-[#1ec8a0] bg-[#e6faf5] pl-0.5 text-[#0fa07e] dark:bg-emerald-950/40 dark:text-emerald-200"
                : "text-[#96a0b0] hover:bg-ds-interactive-hover hover:text-[#1a2030] dark:text-ds-muted dark:hover:bg-ds-interactive-hover dark:hover:text-ds-foreground"
            }`}
            onClick={() => !effectiveDisabled && onToolChange(tool)}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}

      <div className="min-h-2 flex-1" aria-hidden />

      <div className="mx-auto my-1 h-px w-[22px] shrink-0 bg-[#e2e6ec] dark:bg-ds-border/50" aria-hidden />

      <button
        type="button"
        className={`${BTN} mx-auto text-[#96a0b0] opacity-50 dark:text-ds-muted`}
        disabled
        title="System layer toggles are in the left panel (Fiber, Irrigation, …)"
        aria-label="Layers (see side panel)"
      >
        <Layers className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}
