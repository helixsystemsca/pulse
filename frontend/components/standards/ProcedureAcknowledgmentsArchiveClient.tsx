"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  fetchProcedureAcknowledgmentArchive,
  type ProcedureAcknowledgmentArchiveItem,
} from "@/lib/procedureAcknowledgmentsArchiveApi";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import { Button } from "@/components/ui/Button";

function statusChip(status: ProcedureAcknowledgmentArchiveItem["compliance_status"]) {
  if (status === "current") {
    return (
      <span className="inline-flex rounded-md border border-emerald-500/35 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
        Current
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-md border border-amber-500/35 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-950 dark:bg-amber-950/35 dark:text-amber-100">
      Outdated
    </span>
  );
}

export function ProcedureAcknowledgmentsArchiveClient() {
  const [items, setItems] = useState<ProcedureAcknowledgmentArchiveItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [workerId, setWorkerId] = useState("");
  const [procedureId, setProcedureId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "current" | "outdated">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const page = await fetchProcedureAcknowledgmentArchive({
        worker_id: workerId.trim() || undefined,
        procedure_id: procedureId.trim() || undefined,
        status_filter: statusFilter,
        date_from: dateFrom.trim() || undefined,
        date_to: dateTo.trim() || undefined,
        limit,
        offset,
      });
      setItems(page.items);
      setTotal(page.total);
    } catch (e) {
      setErr(parseClientApiError(e).message);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [workerId, procedureId, statusFilter, dateFrom, dateTo, limit, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-ds-border/90 bg-ds-primary p-4 shadow-sm dark:border-ds-border dark:bg-ds-secondary/40">
        <p className="text-sm text-ds-muted">
          Append-only acknowledgment ledger. Rows are never rewritten; &quot;Outdated&quot; means a newer procedure revision exists than
          the revision acknowledged on that row.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={dsLabelClass} htmlFor="ack-filter-worker">
              Worker ID
            </label>
            <input id="ack-filter-worker" className={dsInputClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)} />
          </div>
          <div>
            <label className={dsLabelClass} htmlFor="ack-filter-proc">
              Procedure ID
            </label>
            <input id="ack-filter-proc" className={dsInputClass} value={procedureId} onChange={(e) => setProcedureId(e.target.value)} />
          </div>
          <div>
            <label className={dsLabelClass} htmlFor="ack-filter-status">
              Version status
            </label>
            <select
              id="ack-filter-status"
              className={dsInputClass}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">All</option>
              <option value="current">Current</option>
              <option value="outdated">Outdated</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={dsLabelClass} htmlFor="ack-from">
                From
              </label>
              <input id="ack-from" type="date" className={dsInputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className={dsLabelClass} htmlFor="ack-to">
                To
              </label>
              <input id="ack-to" type="date" className={dsInputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Apply filters
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="border-transparent bg-transparent font-normal text-ds-muted hover:bg-ds-secondary/60"
            onClick={() => {
              setWorkerId("");
              setProcedureId("");
              setStatusFilter("all");
              setDateFrom("");
              setDateTo("");
              setOffset(0);
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      {err ? (
        <p className="text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
          {err}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-ds-border/90 bg-ds-primary shadow-sm dark:border-ds-border dark:bg-ds-secondary/30">
        <div className="flex items-center justify-between border-b border-ds-border/80 px-4 py-3 dark:border-ds-border">
          <p className="text-sm font-semibold text-ds-foreground">Records</p>
          <p className="text-xs tabular-nums text-ds-muted">
            {total} total · showing {items.length}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-ds-border/80 bg-ds-secondary/40 text-[11px] font-bold uppercase tracking-wide text-ds-muted dark:border-ds-border">
                <th className="px-3 py-2">Worker</th>
                <th className="px-3 py-2">Procedure</th>
                <th className="px-3 py-2">Ack rev</th>
                <th className="px-3 py-2">Current rev</th>
                <th className="px-3 py-2">Acknowledged at</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ds-muted">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden />
                  </td>
                </tr>
              ) : null}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ds-muted">
                    No rows match the current filters.
                  </td>
                </tr>
              ) : null}
              {items.map((r) => (
                <tr key={r.id} className="border-b border-ds-border/60 hover:bg-ds-secondary/30 dark:border-ds-border/60">
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-ds-foreground">{r.employee_name}</div>
                    <div className="text-[11px] text-ds-muted">{r.employee_user_id}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-ds-foreground">{r.procedure_title}</div>
                    <div className="text-[11px] text-ds-muted">{r.procedure_id}</div>
                  </td>
                  <td className="px-3 py-2 align-top tabular-nums">{r.acknowledged_revision}</td>
                  <td className="px-3 py-2 align-top tabular-nums">{r.procedure_current_revision}</td>
                  <td className="px-3 py-2 align-top text-xs text-ds-muted">{new Date(r.acknowledged_at).toLocaleString()}</td>
                  <td className="px-3 py-2 align-top">{statusChip(r.compliance_status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ds-border/80 px-4 py-3 dark:border-ds-border">
          <Button type="button" variant="secondary" disabled={offset === 0 || loading} onClick={() => setOffset((o) => Math.max(0, o - limit))}>
            Previous
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={loading || offset + limit >= total}
            onClick={() => setOffset((o) => o + limit)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
