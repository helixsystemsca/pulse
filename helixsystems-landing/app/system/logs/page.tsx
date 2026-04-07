"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type LogRow = {
  id: string;
  action: string;
  performed_by: string | null;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  logged_at: string;
};

type FilterPayload = {
  limit: number;
  offset: number;
  action: string;
  search: string;
  targetType: string;
  targetId: string;
  performedBy: string;
  since: string;
  until: string;
};

const EMPTY_FILTERS: Omit<FilterPayload, "limit" | "offset"> = {
  action: "",
  search: "",
  targetType: "",
  targetId: "",
  performedBy: "",
  since: "",
  until: "",
};

const INPUT =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500";
const BTN_SECONDARY =
  "rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";
const BTN_PRIMARY = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500";
const BTN_GHOST =
  "rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white";

function buildQuery(p: FilterPayload): string {
  const q = new URLSearchParams();
  q.set("limit", String(p.limit));
  q.set("offset", String(p.offset));
  if (p.action.trim()) q.set("action", p.action.trim());
  if (p.search.trim()) q.set("search", p.search.trim());
  if (p.targetType.trim()) q.set("target_type", p.targetType.trim());
  if (p.targetId.trim()) q.set("target_id", p.targetId.trim());
  if (p.performedBy.trim()) q.set("performed_by", p.performedBy.trim());
  if (p.since.trim()) {
    const d = new Date(p.since);
    if (!Number.isNaN(d.getTime())) q.set("since", d.toISOString());
  }
  if (p.until.trim()) {
    const d = new Date(p.until);
    if (!Number.isNaN(d.getTime())) q.set("until", d.toISOString());
  }
  return q.toString();
}

function formatLogTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function countActiveFilters(p: Omit<FilterPayload, "limit" | "offset">): number {
  return [
    p.action,
    p.search,
    p.targetType,
    p.targetId,
    p.performedBy,
    p.since,
    p.until,
  ].filter((s) => String(s).trim()).length;
}

export default function SystemLogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionKeys, setActionKeys] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  const [actionExact, setActionExact] = useState("");
  const [search, setSearch] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");

  const activeCount = useMemo(
    () =>
      countActiveFilters({
        action: actionExact,
        search,
        targetType,
        targetId,
        performedBy,
        since,
        until,
      }),
    [actionExact, search, targetType, targetId, performedBy, since, until],
  );

  const runFetch = useCallback(async (p: FilterPayload) => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQuery(p);
      const list = await apiFetch<LogRow[]>(`/api/system/logs?${qs}`);
      setRows(list);
    } catch {
      setError("Could not load logs.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const keys = await apiFetch<string[]>("/api/system/logs/actions?limit=300");
        setActionKeys(keys);
      } catch {
        setActionKeys([]);
      }
    })();
  }, []);

  useEffect(() => {
    void runFetch({ limit: 200, offset: 0, ...EMPTY_FILTERS });
  }, [runFetch]);

  function formToPayload(): FilterPayload {
    return {
      limit: 200,
      offset: 0,
      action: actionExact,
      search,
      targetType,
      targetId,
      performedBy,
      since,
      until,
    };
  }

  function applyFilters() {
    void runFetch(formToPayload());
    setFilterOpen(false);
  }

  function clearFilters() {
    setActionExact("");
    setSearch("");
    setTargetType("");
    setTargetId("");
    setPerformedBy("");
    setSince("");
    setUntil("");
    void runFetch({ limit: 200, offset: 0, ...EMPTY_FILTERS });
    setFilterOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">System logs</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-500">Sensitive actions from the internal admin surface.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Filters
            {activeCount > 0 ? (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">{activeCount}</span>
            ) : null}
          </button>
          <span className="text-xs text-gray-500 dark:text-zinc-500">
            Up to 200 rows · {loading ? "…" : `${rows.length} loaded`}
          </span>
        </div>
      </div>

      {filterOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setFilterOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border border-gray-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-filter-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4 dark:border-zinc-800">
              <div>
                <h2 id="log-filter-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                  Filter logs
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-zinc-500">Narrow by action, actor, target, or time range.</p>
              </div>
              <button type="button" className={BTN_GHOST} onClick={() => setFilterOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-zinc-400" htmlFor="log-action-exact">
                  Action (exact)
                </label>
                <select
                  id="log-action-exact"
                  className={INPUT + " w-full"}
                  value={actionExact}
                  onChange={(e) => setActionExact(e.target.value)}
                >
                  <option value="">Any action</option>
                  {actionKeys.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-zinc-400" htmlFor="log-search">
                  Action search
                </label>
                <input
                  id="log-search"
                  className={INPUT + " w-full"}
                  placeholder="Substring match…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-zinc-400" htmlFor="log-target-type">
                  Target type
                </label>
                <input
                  id="log-target-type"
                  className={INPUT + " w-full"}
                  placeholder="e.g. company, user"
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-zinc-400" htmlFor="log-target-id">
                  Target id
                </label>
                <input
                  id="log-target-id"
                  className={INPUT + " w-full"}
                  placeholder="UUID or id"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-gray-600 dark:text-zinc-400" htmlFor="log-actor">
                  Actor (user id)
                </label>
                <input
                  id="log-actor"
                  className={INPUT + " w-full"}
                  placeholder="Performer UUID"
                  value={performedBy}
                  onChange={(e) => setPerformedBy(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-zinc-400" htmlFor="log-since">
                  From (local)
                </label>
                <input
                  id="log-since"
                  type="datetime-local"
                  className={INPUT + " w-full"}
                  value={since}
                  onChange={(e) => setSince(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-zinc-400" htmlFor="log-until">
                  To (local)
                </label>
                <input
                  id="log-until"
                  type="datetime-local"
                  className={INPUT + " w-full"}
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 pt-5 dark:border-zinc-800">
              <button type="button" className={BTN_SECONDARY} onClick={() => void clearFilters()}>
                Clear all
              </button>
              <button type="button" className={BTN_PRIMARY} onClick={() => void applyFilters()}>
                Apply filters
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-red-600 dark:text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-gray-500 dark:text-zinc-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-zinc-800">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-zinc-900/80 dark:text-zinc-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white/80 dark:divide-zinc-800 dark:bg-zinc-950/50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-zinc-500">
                    No log entries match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500 dark:text-zinc-500">
                      {formatLogTime(r.logged_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-zinc-200">{r.action}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-zinc-500">{r.performed_by || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-zinc-500">
                      {r.target_type || "—"}:{r.target_id || "—"}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-gray-500 dark:text-zinc-500">
                      {JSON.stringify(r.metadata)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
