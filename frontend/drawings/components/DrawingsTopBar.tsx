"use client";

import { ChevronDown, Maximize2, Minimize2, Plus, Save } from "lucide-react";
import { ProjectSelector } from "./ProjectSelector";
import { cn } from "@/lib/cn";

const MAP_CATEGORIES = ["General", "Floor plan", "Aerial", "Site", "Other"] as const;

type MapSummary = {
  id: string;
  name: string;
  category: string;
};

const ctrlBase =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] border px-2.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45";

export function DrawingsTopBar({
  projectReady,
  mapListLoading,
  uploadBusy,
  activeProjectId,
  setActiveProjectId,
  maps,
  activeMapId,
  onMapChange,
  newMapCategory,
  onNewMapCategoryChange,
  onUploadNewMap,
  onSaveMap,
  saveDisabled,
  fullscreen,
  onEnterFullscreen,
  onExitFullscreen,
}: {
  projectReady: boolean;
  mapListLoading: boolean;
  uploadBusy: boolean;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  maps: MapSummary[];
  activeMapId: string;
  onMapChange: (id: string) => void;
  newMapCategory: string;
  onNewMapCategoryChange: (c: string) => void;
  onUploadNewMap: () => void;
  onSaveMap: () => void;
  saveDisabled: boolean;
  fullscreen: boolean;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
}) {
  const busy = mapListLoading || uploadBusy;

  const grouped = (() => {
    const m = new Map<string, MapSummary[]>();
    for (const map of maps) {
      const c = map.category?.trim() || "General";
      if (!m.has(c)) m.set(c, []);
      m.get(c)!.push(map);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  })();

  return (
    <div className="shrink-0 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:bg-ds-secondary/30 dark:shadow-none">
      <header className="flex flex-col">
        <div className="flex min-h-[50px] flex-wrap items-center gap-x-1.5 gap-y-2 px-3.5 py-2 sm:h-[50px] sm:flex-nowrap sm:py-0">
        <span className="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#96a0b0] dark:text-ds-muted">
          Drawings
        </span>

        <span className="hidden h-5 w-px shrink-0 bg-[#d0d6df] sm:block dark:bg-ds-border" aria-hidden />

        <div className="order-last flex w-full min-w-0 flex-1 basis-full items-center gap-1.5 sm:order-none sm:w-auto sm:basis-auto sm:min-w-0">
          <ProjectSelector
            variant="toolbar"
            value={activeProjectId}
            onChange={setActiveProjectId}
            disabled={mapListLoading}
          />

          <button
            type="button"
            className={cn(
              ctrlBase,
              "border-[#b2f0e0] bg-[#e6faf5] text-[#0fa07e] hover:border-[#1ec8a0] hover:bg-[#c8f5e8] hover:shadow-[0_0_0_3px_rgba(30,200,160,0.1)] dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-200",
            )}
            disabled={!projectReady || busy}
            onClick={onUploadNewMap}
            title="Upload a new map image"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="hidden sm:inline">New map</span>
          </button>

          <div className="relative flex shrink-0 items-center">
            <select
              className={cn(
                ctrlBase,
                "w-[124px] cursor-pointer appearance-none border-[#c5d6f5] bg-[#eef3fd] pr-7 text-[#2a5faf] hover:border-[#3a7bd5] hover:bg-[#dce9fb] dark:border-blue-500/40 dark:bg-blue-950/35 dark:text-blue-200",
              )}
              value={newMapCategory}
              onChange={(e) => onNewMapCategoryChange(e.target.value)}
              disabled={!projectReady || busy}
              title="Category for the next uploaded map"
              aria-label="Map category for new uploads"
            >
              {MAP_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#3a7bd5] dark:text-blue-300">
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>

          <div className="relative min-w-0 flex-1">
            <select
              className={cn(
                ctrlBase,
                "h-8 w-full min-w-0 cursor-pointer appearance-none border-[#d0d6df] bg-[#f8f9fb] pr-8 text-[#5a6478] hover:border-[#1ec8a0] hover:bg-white hover:shadow-[0_0_0_3px_rgba(30,200,160,0.08)] focus:border-[#1ec8a0] focus:shadow-[0_0_0_3px_rgba(30,200,160,0.12)] focus:outline-none dark:border-ds-border dark:bg-ds-secondary/30 dark:text-ds-muted dark:hover:bg-ds-secondary/50",
              )}
              aria-label="Select map"
              value={activeMapId}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__upload__") {
                  e.target.value = activeMapId;
                  onUploadNewMap();
                  return;
                }
                onMapChange(v);
              }}
              disabled={!projectReady || busy}
            >
              <option value="">Select map…</option>
              {grouped.map(([cat, list]) => (
                <optgroup key={cat} label={cat}>
                  {list.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value="__upload__">Upload new image…</option>
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#96a0b0] dark:text-ds-muted">
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className={cn(
              ctrlBase,
              "border-[#0fa07e] bg-[#1ec8a0] px-3 font-semibold text-white hover:border-[#0c8a6c] hover:bg-[#0fa07e] hover:shadow-[0_2px_8px_rgba(30,200,160,0.3)] dark:border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700",
            )}
            disabled={saveDisabled}
            onClick={onSaveMap}
            title="Save map overlays and layout to the server"
          >
            <Save className="h-3.5 w-3.5 shrink-0 opacity-95" aria-hidden />
            Save
          </button>
          {fullscreen ? (
            <button
              type="button"
              className={cn(ctrlBase, "border-[#d0d6df] bg-transparent text-[#5a6478] hover:bg-[#f4f6f8] hover:text-[#1a2030] dark:border-ds-border dark:text-ds-muted dark:hover:bg-ds-secondary/40")}
              onClick={onExitFullscreen}
              title="Return to Drawings"
            >
              <Minimize2 className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
              <span className="hidden sm:inline">Exit</span>
            </button>
          ) : (
            <button
              type="button"
              className={cn(ctrlBase, "border-[#d0d6df] bg-transparent text-[#5a6478] hover:bg-[#f4f6f8] hover:text-[#1a2030] dark:border-ds-border dark:text-ds-muted dark:hover:bg-ds-secondary/40")}
              onClick={onEnterFullscreen}
              title="Open fullscreen editor"
            >
              <Maximize2 className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
              <span className="hidden sm:inline">Fullscreen</span>
            </button>
          )}
        </div>
        </div>
        <div
          className="h-[3px] w-full shrink-0 bg-gradient-to-r from-[#1ec8a0] via-[#3a7bd5] to-[#f25c7a] opacity-70"
          aria-hidden
        />
      </header>
    </div>
  );
}
