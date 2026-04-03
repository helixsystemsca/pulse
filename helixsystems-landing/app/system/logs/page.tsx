"use client";

import { useCallback, useEffect, useState } from "react";
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
  "rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";
const BTN_SECONDARY =
  "rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800";
const BTN_PRIMARY = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500";

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

export default function SystemLogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionKeys, setActionKeys] = useState<string[]>([]);

  const [actionExact, setActionExact] = useState("");
  const [search, setSearch] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");

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
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">System logs</h1>
        <p className="mt-1 text-sm text-zinc-500">Sensitive actions from the internal admin surface.</p>
      </div>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Filters</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400" htmlFor="log-action-exact">
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400" htmlFor="log-search">
              Action search
            </label>
            <input
              id="log-search"
              className={INPUT + " w-full"}
              placeholder="Substring match…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <p className="text-[11px] text-zinc-600">Narrow further when many action types exist.</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400" htmlFor="log-target-type">
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400" htmlFor="log-target-id">
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400" htmlFor="log-actor">
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400" htmlFor="log-since">
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400" htmlFor="log-until">
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
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className={BTN_PRIMARY} onClick={() => void applyFilters()}>
            Apply filters
          </button>
          <button type="button" className={BTN_SECONDARY} onClick={() => void clearFilters()}>
            Clear
          </button>
          <span className="text-xs text-zinc-500">
            Showing up to 200 rows · {loading ? "…" : `${rows.length} loaded`}
          </span>
        </div>
      </section>

      {error ? <p className="text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
            <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950/50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    No log entries match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">{formatLogTime(r.logged_at)}</td>
                    <td className="px-4 py-3 text-zinc-200">{r.action}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{r.performed_by || "—"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {r.target_type || "—"}:{r.target_id || "—"}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-zinc-500">{JSON.stringify(r.metadata)}</td>
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
