"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, Map as MapIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RoadmapMilestonesRow, RoadmapStatsFooter } from "@/components/roadmap/RoadmapMilestonesRow";
import { RoadmapProjectDrawer } from "@/components/roadmap/RoadmapProjectDrawer";
import { RoadmapSidebar } from "@/components/roadmap/RoadmapSidebar";
import { RoadmapTimeline } from "@/components/roadmap/RoadmapTimeline";
import { apiFetch } from "@/lib/api";
import {
  computeStatsFromProjects,
  deleteProject,
  fetchRoadmapProjectsFromPulse,
  fetchRoadmapTaskMilestones,
  patchRoadmapProjectDates,
} from "@/lib/roadmap/api";
import { createRoadmapStubs } from "@/lib/projectsService";
import { projectOverlapsRange } from "@/lib/roadmap/project-adapter";
import { getTimelineRange, parseIsoDate, toIsoDate } from "@/lib/roadmap/timeline";
import type { RoadmapFilters, RoadmapMilestone, RoadmapProjectListRow, RoadmapStats, RoadmapZoom } from "@/lib/roadmap/types";
import { isUserFeatureEnabled } from "@/lib/features/tenant-features";
import { hasRbacPermission } from "@/lib/rbac/session-access";
import { readSession } from "@/lib/pulse-session";
import type { PulseWorkerApi } from "@/lib/schedule/pulse-bridge";
import { cn } from "@/lib/cn";

const ZOOMS: { id: RoadmapZoom; label: string }[] = [
  { id: "year", label: "Year" },
  { id: "half_year", label: "6 Month" },
  { id: "quarter", label: "Quarter" },
  { id: "month", label: "Month" },
];

const DEFAULT_FILTERS: RoadmapFilters = {
  search: "",
  categories: [],
  owners: [],
  statuses: [],
  priorities: [],
  tags: [],
  showArchived: false,
  showDependencies: false,
};

export function RoadmapApp() {
  const searchParams = useSearchParams();
  const session = readSession();
  const canEdit =
    isUserFeatureEnabled(session, "projects") && hasRbacPermission(session, "projects.view");
  const now = new Date();
  const yearFromUrl = Number(searchParams.get("year"));
  const [year, setYear] = useState(
    Number.isFinite(yearFromUrl) && yearFromUrl >= 2000 && yearFromUrl <= 2100 ? yearFromUrl : now.getFullYear(),
  );
  const [zoom, setZoom] = useState<RoadmapZoom>("year");
  const [anchorMonth, setAnchorMonth] = useState(now.getMonth());
  const [projects, setProjects] = useState<RoadmapProjectListRow[]>([]);
  const [milestones, setMilestones] = useState<RoadmapMilestone[]>([]);
  const [stats, setStats] = useState<RoadmapStats | null>(null);
  const [filters, setFilters] = useState<RoadmapFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [workers, setWorkers] = useState<PulseWorkerApi[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const range = useMemo(() => getTimelineRange(year, zoom, anchorMonth), [year, zoom, anchorMonth]);
  const rangeStart = toIsoDate(range.start);
  const rangeEnd = toIsoDate(range.end);

  const refresh = useCallback(async () => {
    let ownerMap = new Map<string, string>();
    try {
      const w = await apiFetch<PulseWorkerApi[]>("/api/v1/pulse/workers");
      setWorkers(w);
      ownerMap = new Map(w.map((x) => [x.id, (x.full_name || x.email || "User").trim()]));
    } catch {
      setWorkers([]);
    }

    const [rows, ms] = await Promise.all([
      fetchRoadmapProjectsFromPulse(ownerMap),
      fetchRoadmapTaskMilestones(year),
    ]);
    setProjects(rows);
    setMilestones(ms);
    const st = computeStatsFromProjects(rows.filter((p) => !p.archived));
    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30);
    const horizonIso = horizon.toISOString().slice(0, 10);
    st.upcoming_milestones = ms.filter(
      (m) => !m.completed && m.milestone_date >= today && m.milestone_date <= horizonIso,
    ).length;
    setStats(st);
  }, [year]);

  useEffect(() => {
    void refresh().catch(() => {
      setProjects([]);
      setMilestones([]);
    });
  }, [refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  const applyListFilters = useCallback(
    (rows: RoadmapProjectListRow[]) => {
      let out = rows.filter((p) => (filters.showArchived ? p.archived : !p.archived));
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        out = out.filter((p) => p.title.toLowerCase().includes(q));
      }
      if (filters.categories.length) {
        out = out.filter((p) => filters.categories.includes(p.category));
      }
      return out.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.title.localeCompare(b.title));
    },
    [filters],
  );

  const sidebarProjects = useMemo(() => applyListFilters(projects), [projects, applyListFilters]);

  const timelineProjects = useMemo(
    () => sidebarProjects.filter((p) => projectOverlapsRange(p.start_date, p.end_date, rangeStart, rangeEnd)),
    [sidebarProjects, rangeStart, rangeEnd],
  );

  const offTimelineCount = sidebarProjects.length - timelineProjects.length;

  const owners = useMemo(() => [...new Set(projects.map((p) => p.owner).filter(Boolean))] as string[], [projects]);

  function scheduleDatesSave(id: string, start: string, end: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void patchRoadmapProjectDates(id, start, end).then(refresh);
    }, 400);
  }

  function selectProject(id: string) {
    const p = sidebarProjects.find((x) => x.id === id);
    if (p && !projectOverlapsRange(p.start_date, p.end_date, rangeStart, rangeEnd)) {
      setYear(parseIsoDate(p.start_date).getFullYear());
      setAnchorMonth(parseIsoDate(p.start_date).getMonth());
    }
    setSelectedId(id);
    setDrawerOpen(true);
  }

  async function handleCreateStubs(items: import("@/lib/projectsService").RoadmapStubItem[]) {
    await createRoadmapStubs(items, year);
    await refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project? This removes it from Projects as well.")) return;
    await deleteProject(id);
    if (selectedId === id) {
      setSelectedId(null);
      setDrawerOpen(false);
    }
    await refresh();
  }

  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const order = ZOOMS.map((z) => z.id);
    const idx = order.indexOf(zoom);
    const next = e.deltaY > 0 ? Math.min(order.length - 1, idx + 1) : Math.max(0, idx - 1);
    setZoom(order[next]!);
  }

  if (!isUserFeatureEnabled(session, "projects")) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-ds-border bg-ds-secondary/30 p-8 text-center">
        <MapIcon className="mx-auto h-10 w-10 text-ds-muted" />
        <h1 className="mt-4 text-lg font-semibold text-ds-foreground">Strategic Roadmap</h1>
        <p className="mt-2 text-sm text-ds-muted">
          Roadmap displays projects from the Projects module. Enable <strong>Projects</strong> on your tenant contract to
          use this view.
        </p>
        <Link href="/projects" className="mt-4 inline-block text-sm font-medium text-ds-primary hover:underline">
          Go to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-var(--pulse-header-height)-6.5rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-ds-border/60 bg-ds-bg shadow-sm">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-ds-border/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-ds-primary" />
            <div>
              <h1 className="text-base font-semibold text-ds-foreground">Strategic Roadmap</h1>
              <p className="text-[11px] text-ds-muted">
                Same projects as the Projects tab — quick-add here or build out there first
              </p>
            </div>
          </div>
            <Link
            href="/projects"
            className="inline-flex items-center gap-1 rounded-lg border border-ds-border px-2.5 py-1 text-xs font-medium text-ds-muted hover:bg-ds-secondary hover:text-ds-foreground"
          >
            Project list
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-ds-border bg-ds-secondary/30">
            <button type="button" className="rounded-l-lg p-2 hover:bg-ds-secondary" onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[4rem] text-center text-sm font-semibold tabular-nums">{year}</span>
            <button type="button" className="rounded-r-lg p-2 hover:bg-ds-secondary" onClick={() => setYear((y) => y + 1)} aria-label="Next year">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex rounded-lg border border-ds-border bg-ds-secondary/30 p-0.5">
            {ZOOMS.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => setZoom(z.id)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                  zoom === z.id ? "bg-ds-bg text-ds-foreground shadow-sm" : "text-ds-muted hover:text-ds-foreground",
                )}
              >
                {z.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rounded-lg border border-ds-border px-3 py-1.5 text-xs font-medium text-ds-muted hover:bg-ds-secondary"
            onClick={() => {
              setYear(now.getFullYear());
              setAnchorMonth(now.getMonth());
            }}
          >
            Today
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1" onWheel={onWheel}>
        <RoadmapSidebar
          year={year}
          projects={sidebarProjects}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          filters={filters}
          canEdit={canEdit}
          selectedId={selectedId}
          owners={owners}
          allTags={[]}
          onFiltersChange={setFilters}
          onCreateStubs={handleCreateStubs}
          onRefresh={() => void refresh()}
          onSelect={selectProject}
          onEdit={selectProject}
          onDelete={(id) => void handleDelete(id)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {offTimelineCount > 0 && (
            <p className="shrink-0 border-b border-ds-border/40 bg-amber-500/5 px-4 py-2 text-xs text-ds-muted">
              {offTimelineCount} project{offTimelineCount === 1 ? "" : "s"} in the list {offTimelineCount === 1 ? "falls" : "fall"} outside this period — select one to jump to its dates.
            </p>
          )}
          <RoadmapTimeline
            projects={timelineProjects}
            range={range}
            zoom={zoom}
            year={year}
            selectedId={selectedId}
            canEdit={canEdit}
            showDependencies={filters.showDependencies}
            onSelectProject={selectProject}
            onDatesChange={scheduleDatesSave}
          />
          <RoadmapMilestonesRow
            milestones={milestones}
            projects={timelineProjects}
            range={range}
            onSelect={(m) => {
              if (m.roadmap_project_id) {
                setSelectedId(m.roadmap_project_id);
                setDrawerOpen(true);
              }
            }}
          />
          <RoadmapStatsFooter stats={stats} />
        </div>
      </div>

      <RoadmapProjectDrawer
        projectId={selectedId}
        open={drawerOpen}
        canEdit={canEdit}
        workers={workers}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
