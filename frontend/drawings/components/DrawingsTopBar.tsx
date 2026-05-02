"use client";

import { Camera, Maximize2, Minimize2 } from "lucide-react";
import { ProjectSelector } from "./ProjectSelector";

type BlueprintOption = { id: string; name: string };

export function DrawingsTopBar({
  titleLeft,
  projectReady,
  bpLoading,
  activeProjectId,
  setActiveProjectId,
  blueprints,
  selectedBlueprintId,
  setSelectedBlueprintId,
  onSnapshot,
  fullscreen,
  onEnterFullscreen,
  onExitFullscreen,
}: {
  titleLeft: string;
  projectReady: boolean;
  bpLoading: boolean;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  blueprints: BlueprintOption[];
  selectedBlueprintId: string;
  setSelectedBlueprintId: (id: string) => void;
  onSnapshot: () => void;
  fullscreen: boolean;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
}) {
  return (
    <div className="bg-ds-success text-[var(--ds-on-accent)]">
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-black/10 px-3 dark:border-white/10">
      <div className="flex min-w-0 flex-[0_1_180px] items-center">
        <span className="truncate text-sm font-semibold tracking-tight text-[var(--ds-on-accent)]">{titleLeft}</span>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
        <ProjectSelector
          variant="inline"
          value={activeProjectId}
          onChange={setActiveProjectId}
          disabled={bpLoading}
        />
        <select
          className="app-field h-9 min-h-0 w-[min(100%,18rem)] py-0 text-sm"
          value={selectedBlueprintId}
          onChange={(e) => setSelectedBlueprintId(e.target.value)}
          disabled={!projectReady || bpLoading || blueprints.length === 0}
        >
          {blueprints.length === 0 ? <option value="">No blueprints yet</option> : null}
          {blueprints.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-[0_1_auto] shrink-0 items-center justify-end gap-2">
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--ds-on-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--ds-on-accent)_12%,transparent)] px-3 text-xs font-semibold text-[var(--ds-on-accent)] hover:bg-[color-mix(in_srgb,var(--ds-on-accent)_18%,transparent)]"
          onClick={onSnapshot}
          title="Placeholder — future versioned snapshots"
        >
          <Camera className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          <span className="hidden sm:inline">Save snapshot</span>
        </button>
        {fullscreen ? (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--ds-on-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--ds-on-accent)_12%,transparent)] px-3 text-xs font-semibold text-[var(--ds-on-accent)] hover:bg-[color-mix(in_srgb,var(--ds-on-accent)_18%,transparent)]"
            onClick={onExitFullscreen}
            title="Return to Drawings"
          >
            <Minimize2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span className="hidden sm:inline">Exit</span>
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--ds-on-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--ds-on-accent)_12%,transparent)] px-3 text-xs font-semibold text-[var(--ds-on-accent)] hover:bg-[color-mix(in_srgb,var(--ds-on-accent)_18%,transparent)]"
            onClick={onEnterFullscreen}
            title="Open fullscreen editor"
          >
            <Maximize2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span className="hidden sm:inline">Fullscreen</span>
          </button>
        )}
      </div>
    </header>
    </div>
  );
}
