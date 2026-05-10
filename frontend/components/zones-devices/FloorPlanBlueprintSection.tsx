"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { apiFetch, isApiMode } from "@/lib/api";
import { mapApiElement, parseApiBlueprintLayers, type ApiBlueprintElement } from "@/lib/blueprint-layout";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { canAccessPulseTenantApis } from "@/lib/pulse-session";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import type { BlueprintReadOnlyTheme } from "./BlueprintReadOnlyCanvas";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const BlueprintReadOnlyCanvas = dynamic(
  () => import("./BlueprintReadOnlyCanvas").then((m) => ({ default: m.BlueprintReadOnlyCanvas })),
  { ssr: false, loading: () => <div className="min-h-[420px] animate-pulse rounded-lg bg-ds-secondary" /> },
);

type BlueprintSummary = { id: string; name: string; created_at: string };

type BlueprintDetail = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  elements: ApiBlueprintElement[];
  layers?: unknown;
  tasks?: Array<{ id: string; title: string; mode: string; content: string | string[]; linked_element_ids: string[] }>;
};

function blueprintLoadMessage(err: unknown): string {
  const { message, status } = parseClientApiError(err);
  if (status === 401) {
    return "Sign in to load blueprints.";
  }
  if (status === 403) {
    return message !== "Request failed" ? message : "You do not have permission to view blueprints.";
  }
  return message;
}

function useDocumentDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

export function FloorPlanBlueprintSection() {
  const { session } = usePulseAuth();
  const isDark = useDocumentDark();
  const theme: BlueprintReadOnlyTheme = isDark ? "dark" : "light";
  const tenantOk = Boolean(isApiMode() && session && canAccessPulseTenantApis(session));

  const [list, setList] = useState<BlueprintSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detail, setDetail] = useState<BlueprintDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    if (!tenantOk) {
      setList([]);
      setSelectedId("");
      setDetail(null);
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    setError(null);
    try {
      const rows = await apiFetch<BlueprintSummary[]>("/api/blueprints");
      setList(rows);
      setSelectedId((cur) => {
        if (rows.length === 0) return "";
        if (cur && rows.some((r) => r.id === cur)) return cur;
        return rows[0]!.id;
      });
    } catch (e) {
      setError(blueprintLoadMessage(e));
      setList([]);
      setSelectedId("");
      setDetail(null);
    } finally {
      setLoadingList(false);
    }
  }, [tenantOk]);

  useEffect(() => {
    void refreshList();
  }, [refreshList, session?.sub, session?.company_id]);

  useEffect(() => {
    if (!tenantOk || !selectedId) {
      setDetail(null);
      setLoadingDetail(false);
      setSelectedElementId(null);
      return;
    }
    let cancel = false;
    setLoadingDetail(true);
    setError(null);
    (async () => {
      try {
        const d = await apiFetch<BlueprintDetail>(`/api/blueprints/${selectedId}`);
        if (!cancel) setDetail(d);
      } catch (e) {
        if (!cancel) {
          setError(blueprintLoadMessage(e));
          setDetail(null);
        }
      } finally {
        if (!cancel) setLoadingDetail(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [tenantOk, selectedId]);

  const elements = useMemo(
    () => (detail ? detail.elements.map(mapApiElement) : []),
    [detail],
  );

  const blueprintLayers = useMemo(
    () => (detail ? parseApiBlueprintLayers(detail.layers) : []),
    [detail],
  );

  const isCompanyAdmin = sessionHasAnyRole(session, "company_admin");
  const canDelete = Boolean(tenantOk && isCompanyAdmin && selectedId && !loadingList && !deleting);

  async function deleteSelected() {
    if (!canDelete) return;
    const name = detail?.name ?? "this blueprint";
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await apiFetch(`/api/blueprints/${selectedId}`, { method: "DELETE" });
      await refreshList();
      setDetail(null);
    } catch (e) {
      setError(blueprintLoadMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  if (!isApiMode()) {
    return (
      <div className="rounded-md border border-ds-border bg-ds-secondary p-4">
        <p className="m-0 text-sm text-ds-muted">Connect to the API to view saved blueprints on this page.</p>
      </div>
    );
  }

  if (!session?.access_token || !canAccessPulseTenantApis(session)) {
    return (
      <div className="rounded-md border border-ds-border bg-ds-secondary p-4">
        <p className="m-0 text-sm text-ds-foreground">
          Sign in with a <strong>company</strong> account to list blueprints. System admins: use Impersonate, then reload.
        </p>
      </div>
    );
  }

  return (
    <div className="ds-premium-panel p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <label htmlFor="floor-plan-blueprint" className="text-xs font-semibold uppercase tracking-wide text-ds-muted">
            Blueprint preview
          </label>
          <select
            id="floor-plan-blueprint"
            className="app-field mt-1.5 w-full max-w-md font-medium shadow-sm focus:border-ds-success/40 focus:ring-2 focus:ring-[var(--ds-focus-ring)]"
            value={selectedId}
            disabled={loadingList || list.length === 0}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {list.length === 0 ? (
              <option value="">No blueprints yet</option>
            ) : (
              list.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "inline-flex items-center justify-center px-3 py-2 text-sm font-semibold")}
            onClick={() => void deleteSelected()}
            disabled={!canDelete}
            aria-disabled={!canDelete}
            title={
              !isCompanyAdmin
                ? "Only company admins can delete blueprints"
                : !selectedId
                  ? "Select a blueprint to delete"
                  : undefined
            }
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <Link
            href="/drawings"
            className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "inline-flex items-center justify-center px-3 py-2 text-sm font-semibold")}
          >
            Open Drawings
          </Link>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-ds-danger">{error}</p> : null}

      {!loadingList && list.length === 0 ? (
        <p className="mt-4 text-sm text-ds-muted">
          No blueprints found. Add and edit maps under{" "}
          <Link href="/drawings" className="ds-link font-semibold">
            Drawings
          </Link>
          .
        </p>
      ) : null}

      {selectedId && list.length > 0 ? (
        <div className="mt-4 rounded-lg border border-ds-border bg-ds-secondary p-3">
          {loadingDetail ? (
            <div className="min-h-[420px] animate-pulse rounded-lg bg-ds-primary/80" />
          ) : detail ? (
            <>
              <p className="mb-2 text-sm font-medium text-ds-foreground">{detail.name}</p>
              <BlueprintReadOnlyCanvas
                elements={elements}
                layers={blueprintLayers}
                theme={theme}
                fitResetKey={detail.id}
                onSelectElementId={(id) => setSelectedElementId(id)}
              />
              {detail.tasks && detail.tasks.length > 0 ? (
                <div className="mt-3 rounded-md border border-ds-border bg-ds-primary p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ds-muted mb-2">
                    Instructions — tap an element to see its tasks
                  </p>
                  {selectedElementId ? (
                    <>
                      {detail.tasks
                        .filter((t) => t.linked_element_ids.includes(selectedElementId))
                        .map((task) => (
                          <div key={task.id} className="mb-3 last:mb-0">
                            <p className="text-xs font-semibold text-ds-foreground mb-1">{task.title}</p>
                            {task.mode === "steps" && Array.isArray(task.content)
                              ? (task.content as string[]).map((step, i) => (
                                  <div key={i} className="flex gap-2 text-xs text-ds-muted mb-1">
                                    <span className="shrink-0 font-bold text-ds-accent">{i + 1}.</span>
                                    <span>{step}</span>
                                  </div>
                                ))
                              : <p className="text-xs text-ds-muted">{task.content as string}</p>}
                          </div>
                        ))}
                      {detail.tasks.filter((t) => t.linked_element_ids.includes(selectedElementId)).length === 0 ? (
                        <p className="text-xs text-ds-muted">No instructions for this element.</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-ds-muted">Tap any room or element on the map above.</p>
                  )}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
