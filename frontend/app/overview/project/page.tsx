"use client";

import { DashboardViewTabs } from "@/components/dashboard/DashboardViewTabs";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { isApiMode } from "@/lib/api";
import { DEFAULT_KIOSK_WIDGETS, loadKioskWidgetConfig, saveKioskWidgetConfig } from "@/lib/project-kiosk/kioskWidgetConfig";
import type { KioskWidgetDefinition } from "@/lib/project-kiosk/types";
import { buildProjectKioskView } from "@/lib/project-kiosk/buildProjectKioskView";
import { useProjectKioskRealtime } from "@/lib/project-kiosk/useProjectKioskRealtime";
import { navigateToPulseLogin, pulseApp } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { listProjects, getProject, listProjectActivity, type ProjectRow } from "@/lib/projectsService";
import { apiFetch } from "@/lib/api";
import type { PulseWorkerApi } from "@/lib/schedule/pulse-bridge";
import { UI } from "@/styles/ui";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_SELECTED_PROJECT = "pulse_dashboard_project_id_v1";

const BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2.5");
const BTN_SEC = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2");

export default function OverviewProjectTabPage() {
  const router = useRouter();
  const { session } = usePulseAuth();
  const [ready, setReady] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [widgets, setWidgets] = useState<KioskWidgetDefinition[]>(DEFAULT_KIOSK_WIDGETS);
  const [previewJson, setPreviewJson] = useState<string>("");
  const [previewErr, setPreviewErr] = useState<string | null>(null);

  useEffect(() => {
    const s = readSession();
    if (!s) {
      navigateToPulseLogin();
      return;
    }
    if (isApiMode() && !s.access_token) {
      navigateToPulseLogin();
      return;
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!session?.can_use_pm_features) {
      router.replace(pulseApp.to("/overview"));
    }
  }, [ready, router, session?.can_use_pm_features]);

  useEffect(() => {
    if (!ready || !session?.can_use_pm_features) return;
    setWidgets(loadKioskWidgetConfig());
    try {
      const saved = window.localStorage.getItem(STORAGE_SELECTED_PROJECT);
      if (saved) setSelectedId(saved);
    } catch {
      /* ignore */
    }
    void (async () => {
      try {
        const list = await listProjects();
        setProjects(list ?? []);
        setSelectedId((id) => {
          if (id && list?.some((p) => p.id === id)) return id;
          return list?.[0]?.id ?? "";
        });
      } catch {
        setProjects([]);
      }
    })();
  }, [ready, session?.can_use_pm_features]);

  useEffect(() => {
    if (!selectedId) return;
    try {
      window.localStorage.setItem(STORAGE_SELECTED_PROJECT, selectedId);
    } catch {
      /* ignore */
    }
  }, [selectedId]);

  const recomputePreview = useCallback(async () => {
    if (!selectedId) return;
    setPreviewErr(null);
    try {
      const [detail, activity, workers] = await Promise.all([
        getProject(selectedId),
        listProjectActivity(selectedId),
        apiFetch<PulseWorkerApi[]>("/api/v1/pulse/workers"),
      ]);
      const view = buildProjectKioskView(detail, activity ?? [], workers ?? [], loadKioskWidgetConfig());
      setPreviewJson(JSON.stringify(view, null, 2));
    } catch (e: unknown) {
      setPreviewErr(e instanceof Error ? e.message : "Preview failed");
      setPreviewJson("");
    }
  }, [selectedId]);

  useEffect(() => {
    void recomputePreview();
  }, [recomputePreview, widgets]);

  useProjectKioskRealtime({
    projectId: selectedId,
    enabled: Boolean(ready && session?.can_use_pm_features && selectedId),
    onInvalidate: () => void recomputePreview(),
  });

  const openKiosk = () => {
    if (!selectedId) return;
    const url = `${window.location.origin}/kiosk/project/${encodeURIComponent(selectedId)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const toggleHighValue = (id: string, next: boolean) => {
    const w = widgets.map((x) => (x.id === id ? { ...x, isHighValue: next } : x));
    setWidgets(w);
    saveKioskWidgetConfig(w);
  };

  const selectedLabel = useMemo(() => projects.find((p) => p.id === selectedId)?.name ?? "", [projects, selectedId]);

  if (!ready || !session?.can_use_pm_features) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className={UI.subheader}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pulse-dashboard-canvas space-y-4 px-2 py-4 sm:px-2 sm:py-5">
        <DashboardViewTabs />
        <div className="rounded-xl border border-ds-border bg-ds-primary p-5 shadow-[var(--ds-shadow-card)]">
          <h1 className="text-xl font-bold text-ds-foreground">Project kiosk</h1>
          <p className="mt-1 text-sm text-ds-muted">
            Pick a tenant project, tune which panels stay pinned versus rotating on the TV, then open kiosk mode in a
            new window. Updates stream over the realtime connection (no polling).
          </p>

          <div className="mt-6 flex flex-wrap items-end gap-4">
            <div className="min-w-[14rem] flex-1">
              <label className="text-xs font-semibold uppercase text-ds-muted" htmlFor="proj-pick">
                Project
              </label>
              <select
                id="proj-pick"
                className="mt-1.5 w-full rounded-lg border border-ds-border bg-ds-secondary px-3 py-2 text-sm text-ds-foreground"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className={BTN} disabled={!selectedId} onClick={openKiosk}>
              Open kiosk mode
            </button>
          </div>

          <div className="mt-8 border-t border-ds-border pt-6">
            <h2 className="text-sm font-bold text-ds-foreground">High-value (locked) panels</h2>
            <p className="mt-1 text-xs text-ds-muted">Each widget can stay fixed on the kiosk or join the 15-second rotation.</p>
            <ul className="mt-4 space-y-2">
              {widgets.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ds-border bg-ds-secondary/40 px-3 py-2">
                  <span className="text-sm font-semibold text-ds-foreground">{w.label}</span>
                  <label className="flex items-center gap-2 text-xs font-semibold text-ds-muted">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[color-mix(in_srgb,var(--ds-success)_70%,transparent)]"
                      checked={w.isHighValue}
                      onChange={(e) => toggleHighValue(w.id, e.target.checked)}
                    />
                    High value (locked)
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 border-t border-ds-border pt-6">
            <h2 className="text-sm font-bold text-ds-foreground">View model preview</h2>
            <p className="mt-1 text-xs text-ds-muted">
              Live shape from <code className="rounded bg-ds-secondary px-1">getProjectKioskView</code> for{" "}
              <strong>{selectedLabel || "—"}</strong>.
            </p>
            {previewErr ? <p className="mt-2 text-sm text-ds-danger">{previewErr}</p> : null}
            {previewJson ? (
              <pre className="mt-3 max-h-[min(24rem,50vh)] overflow-auto rounded-lg border border-ds-border bg-black/80 p-3 text-[11px] leading-relaxed text-emerald-100/90">
                {previewJson}
              </pre>
            ) : (
              !previewErr && <p className="mt-2 text-sm text-ds-muted">Select a project to generate the view model.</p>
            )}
            <button type="button" className={`${BTN_SEC} mt-3`} disabled={!selectedId} onClick={() => void recomputePreview()}>
              Refresh preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
