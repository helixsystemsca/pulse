"use client";

import { ChevronDown, Maximize2, Minimize2, Plus, Save } from "lucide-react";
import { ProjectSelector } from "./ProjectSelector";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import { DASH } from "@/styles/dashboardTheme";

const MAP_CATEGORIES = ["General", "Facility map", "Floor plan", "Aerial", "Site", "Other"] as const;

/** Uniform toolbar copy — Poppins regular via parent `font-manrope`. */
const TOOLBAR_TEXT = "text-sm font-normal leading-normal text-ds-foreground";

type MapSummary = {
  id: string;
  name: string;
  category: string;
};

const ctrlBase = cn(
  buttonVariants({ surface: "light", intent: "secondary" }),
  "min-h-9 rounded-lg border px-3 py-2 text-sm font-normal tracking-normal shadow-sm",
);

const ctrlAccent = cn(
  buttonVariants({ surface: "light", intent: "accent" }),
  "min-h-9 rounded-lg border px-3 py-2 text-sm font-normal tracking-normal shadow-sm",
);

export function DrawingsTopBar({
  mapsToolbarDisabled,
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
  /** When true, map picker / upload / category controls are disabled (e.g. offline or busy). */
  mapsToolbarDisabled: boolean;
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
        <div className="flex min-h-[52px] flex-wrap items-center gap-x-2 gap-y-2.5 px-4 py-3 sm:flex-nowrap">
        <span className={cn(TOOLBAR_TEXT, "shrink-0")}>Drawings</span>

        <span className="hidden h-5 w-px shrink-0 bg-[#d0d6df] sm:block dark:bg-ds-border" aria-hidden />

        <div className="order-last flex w-full min-w-0 flex-1 basis-full flex-wrap items-center gap-1.5 sm:order-none sm:w-auto sm:basis-auto sm:min-w-0 sm:flex-nowrap">
          <button
            type="button"
            className={cn(
              ctrlBase,
              "inline-flex items-center gap-2",
            )}
            disabled={mapsToolbarDisabled}
            onClick={onUploadNewMap}
            title="Upload an image — first step for a new facility map"
          >
            <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
            <span className="hidden sm:inline">Upload image</span>
          </button>

          <div className="relative flex shrink-0 items-center">
            <select
              className={cn(
                ctrlBase,
                "w-[128px] cursor-pointer appearance-none pr-7",
              )}
              value={newMapCategory}
              onChange={(e) => onNewMapCategoryChange(e.target.value)}
              disabled={mapsToolbarDisabled}
              title="Category for the next uploaded map (e.g. Facility map for building / zone layouts)"
              aria-label="Map category for new uploads"
            >
              {MAP_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ds-muted">
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>

          <div className="relative min-w-0 flex-1 basis-[min(100%,12rem)] sm:basis-auto">
            <select
              className={cn(
                ctrlBase,
                "w-full min-w-0 cursor-pointer appearance-none pr-8 focus:outline-none",
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
              disabled={mapsToolbarDisabled}
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
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ds-muted">
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>

          <span className="hidden h-5 w-px shrink-0 bg-[#d0d6df] sm:block dark:bg-ds-border" aria-hidden />

          <div className="flex min-w-0 max-w-[200px] shrink items-center gap-2 sm:max-w-[220px]">
            <span className={cn(TOOLBAR_TEXT, "hidden shrink-0 text-ds-muted lg:inline")}>Project</span>
            <ProjectSelector
              variant="toolbar"
              value={activeProjectId}
              onChange={setActiveProjectId}
              disabled={mapsToolbarDisabled}
            />
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className={cn(
              ctrlAccent,
              "inline-flex items-center gap-2",
            )}
            disabled={saveDisabled}
            onClick={onSaveMap}
            title="Save map overlays and layout to the server"
          >
            <Save className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
            Save
          </button>
          {fullscreen ? (
            <button
              type="button"
              className={cn(ctrlBase, "inline-flex items-center gap-2")}
              onClick={onExitFullscreen}
              title="Return to Drawings"
            >
              <Minimize2 className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
              <span className="hidden sm:inline">Exit</span>
            </button>
          ) : (
            <button
              type="button"
              className={cn(ctrlBase, "inline-flex items-center gap-2")}
              onClick={onEnterFullscreen}
              title="Open fullscreen editor"
            >
              <Maximize2 className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
              <span className="hidden sm:inline">Fullscreen</span>
            </button>
          )}
        </div>
        </div>
        <div
          className={cn(DASH.accentBar, "opacity-80")}
          aria-hidden
        />
      </header>
    </div>
  );
}
