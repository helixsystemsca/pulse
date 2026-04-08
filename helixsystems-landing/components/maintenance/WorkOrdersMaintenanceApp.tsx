"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  createWorkOrder,
  fetchWorkOrderDetail,
  fetchWorkOrders,
  type WorkOrderDetail,
  type WorkOrderRow,
  type WorkOrderType,
} from "@/lib/cmmsApi";
import { parseClientApiError } from "@/lib/parse-client-api-error";

const TYPE_FILTERS: { value: "" | WorkOrderType; label: string }[] = [
  { value: "", label: "All types" },
  { value: "issue", label: "Issue" },
  { value: "preventative", label: "Preventative" },
  { value: "request", label: "Request" },
];

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function WorkOrdersMaintenanceAppInner() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<WorkOrderRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<"" | WorkOrderType>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkOrderDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftType, setDraftType] = useState<WorkOrderType>("issue");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await fetchWorkOrders(typeFilter ? { type: typeFilter } : undefined);
      setRows(list);
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const woFromUrl = searchParams.get("wo");
  useEffect(() => {
    if (!woFromUrl || rows.length === 0) return;
    if (!rows.some((r) => r.id === woFromUrl)) return;
    let cancelled = false;
    void (async () => {
      try {
        const d = await fetchWorkOrderDetail(woFromUrl);
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) setErr(parseClientApiError(e).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [woFromUrl, rows]);

  const openDetail = async (id: string) => {
    setErr(null);
    try {
      const d = await fetchWorkOrderDetail(id);
      setDetail(d);
    } catch (e) {
      setErr(parseClientApiError(e).message);
    }
  };

  const createQuick = async () => {
    const t = draftTitle.trim();
    if (!t) return;
    setCreating(true);
    setErr(null);
    try {
      await createWorkOrder({ title: t, type: draftType });
      setDraftTitle("");
      await load();
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-md border border-pulse-border bg-white p-4 shadow-card dark:border-slate-700 dark:bg-ds-bg/65">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold uppercase text-pulse-muted">
            Type
            <select
              className="ml-2 rounded-lg border border-pulse-border bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-ds-secondary"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "" | WorkOrderType)}
            >
              {TYPE_FILTERS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-pulse-border bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-ds-secondary"
            placeholder="New work order title…"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
          />
          <select
            className="rounded-lg border border-pulse-border bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-ds-secondary"
            value={draftType}
            onChange={(e) => setDraftType(e.target.value as WorkOrderType)}
          >
            <option value="issue">Issue</option>
            <option value="request">Request</option>
            <option value="preventative">Preventative</option>
          </select>
          <button
            type="button"
            disabled={creating || !draftTitle.trim()}
            onClick={() => void createQuick()}
            className="shrink-0 rounded-lg bg-pulse-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {err ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p> : null}

        <div className="mt-4 max-h-[min(60vh,28rem)] overflow-auto rounded-md border border-pulse-border dark:border-slate-700">
          {loading ? (
            <p className="p-4 text-sm text-pulse-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-pulse-muted">No work orders yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-pulse-muted dark:bg-ds-secondary/95">
                <tr>
                  <th className="px-3 py-2 font-semibold">Title</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pulse-border dark:divide-slate-700">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="ds-table-row-hover cursor-pointer"
                    onClick={() => void openDetail(r.id)}
                  >
                    <td className="px-3 py-2 font-medium text-pulse-navy dark:text-slate-100">{r.title}</td>
                    <td className="px-3 py-2 capitalize text-pulse-muted">{r.type}</td>
                    <td className="px-3 py-2 capitalize text-pulse-muted">{r.status.replace("_", " ")}</td>
                    <td className="px-3 py-2 text-pulse-muted">{formatShortDate(r.due_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <aside className="rounded-md border border-pulse-border bg-white p-4 shadow-card dark:border-slate-700 dark:bg-ds-bg/65">
        {!detail ? (
          <p className="text-sm text-pulse-muted">Select a work order to view asset link and procedure steps.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-pulse-navy dark:text-slate-100">{detail.title}</h2>
              <p className="mt-1 text-xs text-pulse-muted">
                {detail.type} · {detail.status.replace("_", " ")}
              </p>
            </div>
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase text-pulse-muted">Asset</dt>
                <dd className="font-mono text-xs text-pulse-navy dark:text-slate-200">
                  {detail.asset_id ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-pulse-muted">Due</dt>
                <dd className="text-pulse-muted">{formatShortDate(detail.due_date)}</dd>
              </div>
              {detail.description ? (
                <div>
                  <dt className="text-xs font-semibold uppercase text-pulse-muted">Notes</dt>
                  <dd className="text-pulse-muted">{detail.description}</dd>
                </div>
              ) : null}
            </dl>
            {detail.procedure ? (
              <div>
                <h3 className="text-sm font-semibold text-pulse-navy dark:text-slate-100">
                  Procedure: {detail.procedure.title}
                </h3>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-pulse-muted">
                  {detail.procedure.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="text-sm text-pulse-muted">No procedure linked.</p>
            )}
            <button
              type="button"
              className="text-sm font-semibold text-pulse-accent hover:underline"
              onClick={() => setDetail(null)}
            >
              Close
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

export function WorkOrdersMaintenanceApp() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[12rem] items-center justify-center rounded-md border border-pulse-border bg-white p-8 dark:border-slate-700 dark:bg-ds-bg/65">
          <p className="text-sm text-pulse-muted">Loading work orders…</p>
        </div>
      }
    >
      <WorkOrdersMaintenanceAppInner />
    </Suspense>
  );
}
