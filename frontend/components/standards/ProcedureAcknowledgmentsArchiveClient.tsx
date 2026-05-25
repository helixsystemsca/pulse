"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileDown, FileText, Loader2, Printer, Search } from "lucide-react";
import {
  fetchProcedureAcknowledgmentArchive,
  fetchProcedureAcknowledgmentPdfBlob,
  type ProcedureAcknowledgmentArchiveItem,
} from "@/lib/procedureAcknowledgmentsArchiveApi";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { cn } from "@/lib/cn";
import { dsInputClass } from "@/components/ui/ds-form-classes";
import { Button } from "@/components/ui/Button";

const MIN_SEARCH_LEN = 2;
const SEARCH_DEBOUNCE_MS = 350;

function PdfActions({ row }: { row: ProcedureAcknowledgmentArchiveItem }) {
  const [busy, setBusy] = useState(false);
  const open = useCallback(
    async (download: boolean) => {
      setBusy(true);
      try {
        const blob = await fetchProcedureAcknowledgmentPdfBlob(row.id, download);
        const url = URL.createObjectURL(blob);
        if (download) {
          const a = document.createElement("a");
          a.href = url;
          a.download = `procedure-acknowledgment-${row.id}.pdf`;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
          window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
        }
      } catch {
        /* surfaced via parent refresh if needed */
      } finally {
        setBusy(false);
      }
    },
    [row.id],
  );

  if (!row.snapshot_id) {
    return <span className="text-[11px] text-ds-muted">No snapshot</span>;
  }
  if (!row.pdf_ready) {
    return (
      <span className="text-[11px] text-ds-muted" title={row.pdf_generation_error ?? undefined}>
        PDF pending…
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      <Button type="button" variant="secondary" className="h-8 px-2 text-[11px]" disabled={busy} onClick={() => void open(false)}>
        <FileText className="h-3.5 w-3.5" aria-hidden />
        View
      </Button>
      <Button type="button" variant="secondary" className="h-8 px-2 text-[11px]" disabled={busy} onClick={() => void open(true)}>
        <FileDown className="h-3.5 w-3.5" aria-hidden />
        Download
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="h-8 px-2 text-[11px]"
        disabled={busy}
        title="Opens the PDF — use the viewer Print command"
        onClick={() => void open(false)}
      >
        <Printer className="h-3.5 w-3.5" aria-hidden />
        Print
      </Button>
    </div>
  );
}

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
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch]);

  const canSearch = debouncedSearch.length >= MIN_SEARCH_LEN;

  const load = useCallback(async () => {
    if (!canSearch) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      setErr(null);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const page = await fetchProcedureAcknowledgmentArchive({
        search: debouncedSearch,
        status_filter: "all",
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
  }, [debouncedSearch, canSearch, limit, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-ds-border/90 bg-ds-primary p-4 shadow-sm dark:border-ds-border dark:bg-ds-secondary/40">
        <p className="text-sm text-ds-muted">
          Search the append-only acknowledgment ledger. Rows are never rewritten; &quot;Outdated&quot; means a newer
          procedure revision exists than the revision acknowledged on that row.
        </p>
        <div className="relative mt-4 max-w-xl">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted"
            aria-hidden
          />
          <input
            type="search"
            className={cn(dsInputClass, "pl-9")}
            placeholder="Search by person, procedure, acknowledge date, or status (current / outdated)…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search acknowledgment archive"
          />
        </div>
        {!canSearch ? (
          <p className="mt-2 text-xs text-ds-muted">Enter at least {MIN_SEARCH_LEN} characters to search.</p>
        ) : null}
      </div>

      {err ? (
        <p className="text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
          {err}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-ds-border/90 bg-ds-primary shadow-sm dark:border-ds-border dark:bg-ds-secondary/30">
        <div className="flex items-center justify-between border-b border-ds-border/80 px-4 py-3 dark:border-ds-border">
          <p className="text-sm font-semibold text-ds-foreground">Records</p>
          {canSearch ? (
            <p className="text-xs tabular-nums text-ds-muted">
              {total} match{total === 1 ? "" : "es"} · showing {items.length}
            </p>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-ds-border/80 bg-ds-secondary/40 text-[11px] font-bold uppercase tracking-wide text-ds-muted dark:border-ds-border">
                <th className="px-3 py-2">Worker</th>
                <th className="px-3 py-2">Procedure</th>
                <th className="px-3 py-2">Ack rev</th>
                <th className="px-3 py-2">Current rev</th>
                <th className="px-3 py-2">Acknowledged at</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Record &amp; PDF</th>
              </tr>
            </thead>
            <tbody>
              {!canSearch ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-ds-muted">
                    Use the search field above to find acknowledgments — the full archive is not listed by default.
                  </td>
                </tr>
              ) : null}
              {canSearch && loading && items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-ds-muted">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden />
                  </td>
                </tr>
              ) : null}
              {canSearch && !loading && items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-ds-muted">
                    No acknowledgments match &quot;{debouncedSearch}&quot;.
                  </td>
                </tr>
              ) : null}
              {items.map((r) => (
                <tr key={r.id} className="border-b border-ds-border/60 hover:bg-ds-secondary/30 dark:border-ds-border/60">
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-ds-foreground">{r.employee_name}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-ds-foreground">{r.procedure_title}</div>
                  </td>
                  <td className="px-3 py-2 align-top tabular-nums">{r.acknowledged_revision}</td>
                  <td className="px-3 py-2 align-top tabular-nums">{r.procedure_current_revision}</td>
                  <td className="px-3 py-2 align-top text-xs text-ds-muted">{new Date(r.acknowledged_at).toLocaleString()}</td>
                  <td className="px-3 py-2 align-top">{statusChip(r.compliance_status)}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col gap-2">
                      {r.snapshot_id ? (
                        <Link
                          href={`/standards/acknowledgments/record/${encodeURIComponent(r.id)}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300"
                        >
                          View record
                        </Link>
                      ) : (
                        <span className="text-[11px] text-ds-muted">No immutable record</span>
                      )}
                      <PdfActions row={r} />
                      <Button type="button" variant="secondary" className="h-7 max-w-[9rem] px-2 text-[10px]" disabled title="Planned: outbound email with PDF attachment.">
                        Email PDF
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canSearch && total > limit ? (
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
        ) : null}
      </div>
    </div>
  );
}
