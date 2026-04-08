"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { apiFetch, isApiMode } from "@/lib/api";
import { mapApiElement, type ApiBlueprintElement } from "@/lib/blueprint-layout";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { canAccessPulseTenantApis } from "@/lib/pulse-session";
import type { BlueprintReadOnlyTheme } from "./BlueprintReadOnlyCanvas";

const BlueprintReadOnlyCanvas = dynamic(
  () => import("./BlueprintReadOnlyCanvas").then((m) => ({ default: m.BlueprintReadOnlyCanvas })),
  { ssr: false, loading: () => <div className="min-h-[420px] animate-pulse rounded-lg bg-slate-100 dark:bg-ds-secondary/95" /> },
);

type BlueprintSummary = { id: string; name: string; created_at: string };

type BlueprintDetail = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  elements: ApiBlueprintElement[];
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
  const [error, setError] = useState<string | null>(null);

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

  const elements = detail ? detail.elements.map(mapApiElement) : [];

  if (!isApiMode()) {
    return (
      <div className="rounded-md border border-pulse-border bg-white p-4 dark:border-slate-600 dark:bg-ds-secondary/95">
        <p className="m-0 text-sm text-pulse-muted">Connect to the API to view saved blueprints on this page.</p>
      </div>
    );
  }

  if (!session?.access_token || !canAccessPulseTenantApis(session)) {
    return (
      <div className="rounded-md border border-pulse-border bg-white p-4 dark:border-slate-600 dark:bg-ds-secondary/95">
        <p className="m-0 text-sm text-pulse-navy dark:text-slate-200">
          Sign in with a <strong>company</strong> account to list blueprints. System admins: use Impersonate, then reload.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-pulse-border bg-white p-4 shadow-card dark:border-slate-700 dark:bg-ds-secondary/95">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <label htmlFor="floor-plan-blueprint" className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">
            Blueprint preview
          </label>
          <select
            id="floor-plan-blueprint"
            className="mt-1.5 w-full max-w-md rounded-md border border-pulse-border bg-white px-3 py-2 text-sm font-medium text-pulse-navy shadow-sm focus:border-pulse-accent focus:outline-none focus:ring-1 focus:ring-pulse-accent/30 dark:border-slate-600 dark:bg-ds-secondary dark:text-slate-100 dark:focus:border-sky-500 dark:focus:ring-sky-500/30"
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
        <Link
          href="/zones-devices/blueprint"
          className="inline-flex shrink-0 items-center justify-center rounded-md border border-pulse-border bg-slate-50 px-3 py-2 text-sm font-semibold text-pulse-navy transition-colors hover:border-pulse-accent/40 dark:border-slate-600 dark:bg-ds-secondary dark:text-slate-100 dark:hover:border-slate-500"
        >
          Edit in designer
        </Link>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {!loadingList && list.length === 0 ? (
        <p className="mt-4 text-sm text-pulse-muted">
          No blueprints found. Create one in the{" "}
          <Link href="/zones-devices/blueprint" className="font-semibold text-pulse-accent hover:underline">
            Blueprint designer
          </Link>
          .
        </p>
      ) : null}

      {selectedId && list.length > 0 ? (
        <div className="mt-4">
          {loadingDetail ? (
            <div className="min-h-[420px] animate-pulse rounded-lg bg-slate-100 dark:bg-ds-secondary/95" />
          ) : detail ? (
            <>
              <p className="mb-2 text-sm font-medium text-pulse-navy dark:text-slate-100">{detail.name}</p>
              <BlueprintReadOnlyCanvas elements={elements} theme={theme} />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
