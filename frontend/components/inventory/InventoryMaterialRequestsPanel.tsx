"use client";

import { ClipboardList, Download, History, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { MaterialRequestExportModal, type MaterialRequestExportForm } from "@/components/inventory/MaterialRequestExportModal";
import {
  createMaterialRequestDraft,
  exportMaterialRequestDraft,
  exportMaterialRequestQueue,
  fetchMaterialRequestExports,
  fetchMaterialRequestQueue,
  formatQueueStatus,
  patchMaterialRequestQueueItem,
  removeMaterialRequestQueueItem,
  submitMaterialRequestDraft,
  type MaterialRequestDraft,
  type MaterialRequestExportRecord,
  type MaterialRequestQueueRow,
} from "@/lib/inventoryMaterialRequestsService";

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-5 py-2.5");
const SECONDARY_BTN = cn(
  buttonVariants({ surface: "light", intent: "secondary" }),
  "px-4 py-2.5 text-sm font-semibold",
);
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

type Props = {
  apiCompany: string | null;
  canMutate: boolean;
  /** Tenant label for export / procurement actions (from inventory wizard settings). */
  procurementActionLabel?: string;
  replenishmentLabel?: string;
  notificationEmailDirectory?: string[];
  defaultMrExportEmails?: string[];
};

function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function InventoryMaterialRequestsPanel({
  apiCompany,
  canMutate,
  procurementActionLabel = "Export Request",
  replenishmentLabel = "Replenishment Queue",
  notificationEmailDirectory = [],
  defaultMrExportEmails = [],
}: Props) {
  const [queue, setQueue] = useState<MaterialRequestQueueRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<MaterialRequestDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reorderDrafts, setReorderDrafts] = useState<Record<string, string>>({});
  const [exportOpen, setExportOpen] = useState(false);
  const [exportHistory, setExportHistory] = useState<MaterialRequestExportRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchMaterialRequestQueue(apiCompany);
      setQueue(items);
      setSelected((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          if (items.some((r) => r.id === id)) next.add(id);
        }
        return next;
      });
      setReorderDrafts((prev) => {
        const out: Record<string, string> = {};
        for (const row of items) {
          out[row.id] = prev[row.id] ?? String(row.reorder_qty);
        }
        return out;
      });
    } catch (e) {
      setError(parseClientApiError(e).message);
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, [apiCompany]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const allSelected = queue.length > 0 && selected.size === queue.length;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(queue.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveReorderQty(row: MaterialRequestQueueRow) {
    const raw = reorderDrafts[row.id] ?? String(row.reorder_qty);
    const reorder_qty = Number.parseFloat(raw);
    if (Number.isNaN(reorder_qty) || reorder_qty < 0) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await patchMaterialRequestQueueItem(apiCompany, row.id, { reorder_qty });
      setQueue((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeRow(id: string) {
    setBusy(true);
    setError(null);
    try {
      await removeMaterialRequestQueueItem(apiCompany, id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await loadQueue();
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function createDraft() {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createMaterialRequestDraft(apiCompany, ids);
      setDraft(created);
      setSelected(new Set());
      await loadQueue();
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitDraft() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await submitMaterialRequestDraft(apiCompany, draft.id);
      setDraft(updated);
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function loadExportHistory() {
    try {
      const items = await fetchMaterialRequestExports(apiCompany);
      setExportHistory(items);
    } catch {
      setExportHistory([]);
    }
  }

  async function handleQueueExport(form: MaterialRequestExportForm) {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    setError(null);
    try {
      await exportMaterialRequestQueue(apiCompany, {
        queue_item_ids: ids,
        project: form.project,
        location: form.location,
        cost_object: form.cost_object || undefined,
        comments: form.comments || undefined,
        notify_emails: form.notify_emails.length ? form.notify_emails : undefined,
      });
      setExportOpen(false);
      setSelected(new Set());
      await loadQueue();
      void loadExportHistory();
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function exportDraft() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await exportMaterialRequestDraft(apiCompany, draft.id);
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = selected.size;

  const queueSection = useMemo(
    () => (
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-pulse-navy dark:text-gray-100">{replenishmentLabel}</h2>
            <p className="text-sm text-pulse-muted">
              Items at or below minimum quantity appear here automatically when stock is updated.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={SECONDARY_BTN}
              disabled={busy}
              onClick={() => {
                setHistoryOpen((v) => !v);
                if (!historyOpen) void loadExportHistory();
              }}
            >
              <History className="mr-2 inline h-4 w-4" aria-hidden />
              Export history
            </button>
            {canMutate ? (
              <>
                <button
                  type="button"
                  className={SECONDARY_BTN}
                  disabled={busy || selectedCount === 0}
                  onClick={() => setExportOpen(true)}
                >
                  <Download className="mr-2 inline h-4 w-4" aria-hidden />
                  {procurementActionLabel.trim() || "Export Request"}
                  {selectedCount > 0 ? ` (${selectedCount})` : ""}
                </button>
                <button
                  type="button"
                  className={PRIMARY_BTN}
                  disabled={busy || selectedCount === 0}
                  onClick={() => void createDraft()}
                >
                  Create draft
                  {selectedCount > 0 ? ` (${selectedCount})` : ""}
                </button>
              </>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-12 text-pulse-muted">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading queue…
          </div>
        ) : queue.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-pulse-muted dark:border-ds-border">
            No items in the queue. When stock drops to the minimum level, items will appear here.
          </p>
        ) : (
          <div className="app-data-shell overflow-x-auto">
            <table className="min-w-[960px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="app-table-head-row border-pulse-border">
                  {canMutate ? (
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        aria-label="Select all"
                        onChange={toggleAll}
                      />
                    </th>
                  ) : null}
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Stockout</th>
                  <th className="px-4 py-3">Current</th>
                  <th className="px-4 py-3">Min</th>
                  <th className="px-4 py-3">Suggested reorder</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Status</th>
                  {canMutate ? <th className="px-4 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {queue.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-ds-border">
                    {canMutate ? (
                      <td className="px-3 py-3 align-middle">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          aria-label={`Select ${row.item_name}`}
                          onChange={() => toggleOne(row.id)}
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-3 font-semibold text-pulse-navy dark:text-gray-100">
                      {row.item_name}
                      {row.anomaly_flag ? (
                        <span className="ml-1 text-xs font-normal text-amber-700 dark:text-amber-300">
                          (anomaly)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-pulse-muted">{row.sku}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          row.urgency_tier === "critical"
                            ? "bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100"
                            : row.urgency_tier === "high"
                              ? "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
                              : "bg-slate-100 text-slate-700 dark:bg-ds-secondary dark:text-ds-muted"
                        }`}
                      >
                        {(row.urgency_tier ?? "normal").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-pulse-muted">
                      {row.days_until_stockout != null ? `${row.days_until_stockout}d` : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.current_qty}</td>
                    <td className="px-4 py-3 tabular-nums">{row.minimum_qty}</td>
                    <td className="px-4 py-3">
                      {canMutate ? (
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm tabular-nums dark:border-ds-border dark:bg-ds-secondary"
                          value={reorderDrafts[row.id] ?? String(row.reorder_qty)}
                          disabled={busy}
                          onChange={(e) =>
                            setReorderDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                          onBlur={() => void saveReorderQty(row)}
                        />
                      ) : (
                        <span className="tabular-nums">{row.reorder_qty}</span>
                      )}
                    </td>
                    <td className="max-w-[10rem] truncate px-4 py-3 text-pulse-muted" title={row.vendor ?? undefined}>
                      {row.vendor?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                        {formatQueueStatus(row.status)}
                      </span>
                    </td>
                    {canMutate ? (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="rounded p-2 text-pulse-muted hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                          aria-label={`Remove ${row.item_name} from queue`}
                          disabled={busy}
                          onClick={() => void removeRow(row.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    ),
    [
      allSelected,
      busy,
      canMutate,
      loading,
      queue,
      reorderDrafts,
      selected,
      selectedCount,
    ],
  );

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <MaterialRequestExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        itemCount={selectedCount}
        busy={busy}
        emailDirectory={notificationEmailDirectory}
        defaultNotifyEmails={defaultMrExportEmails}
        onExport={handleQueueExport}
      />

      {historyOpen ? (
        <section className="rounded-xl border border-slate-200/90 bg-white p-4 dark:border-ds-border dark:bg-ds-primary">
          <h3 className="text-sm font-bold text-pulse-navy dark:text-gray-100">Recent exports</h3>
          {exportHistory.length === 0 ? (
            <p className="mt-2 text-sm text-pulse-muted">No exports recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {exportHistory.map((row) => (
                <li key={row.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-2 last:border-0 dark:border-ds-border">
                  <span className="font-medium text-pulse-navy dark:text-gray-100">{row.file_name}</span>
                  <span className="text-pulse-muted">
                    {row.project} · {row.location} · {row.item_count} items ·{" "}
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {queueSection}

      {draft ? (
        <section className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-ds-border dark:bg-ds-primary">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <ClipboardList className="mt-0.5 h-6 w-6 text-[#2B4C7E] dark:text-sky-300" aria-hidden />
              <div>
                <h2 className="text-lg font-bold text-pulse-navy dark:text-gray-100">Draft view</h2>
                <p className="text-sm text-pulse-muted">
                  <span className="font-semibold text-pulse-navy dark:text-gray-200">{draft.draft_number}</span>
                  {" · "}
                  {new Date(draft.created_at).toLocaleString()}
                  {" · "}
                  <span className="capitalize">{draft.status}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={SECONDARY_BTN} disabled={busy} onClick={() => void exportDraft()}>
                <Download className="mr-2 inline h-4 w-4" aria-hidden />
                {procurementActionLabel.trim() || "Export Request"}
              </button>
              {canMutate && draft.status === "draft" ? (
                <button type="button" className={PRIMARY_BTN} disabled={busy} onClick={() => void submitDraft()}>
                  Submit
                </button>
              ) : null}
              <button type="button" className={SECONDARY_BTN} disabled={busy} onClick={() => setDraft(null)}>
                Close
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="app-table-head-row border-pulse-border">
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Vendor</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">Unit cost</th>
                  <th className="px-4 py-2">Extended</th>
                </tr>
              </thead>
              <tbody>
                {draft.items.map((line) => (
                  <tr key={line.id} className="border-b border-slate-100 dark:border-ds-border">
                    <td className="px-4 py-2 font-medium text-pulse-navy dark:text-gray-100">{line.item_name}</td>
                    <td className="px-4 py-2 text-pulse-muted">{line.sku}</td>
                    <td className="px-4 py-2 text-pulse-muted">{line.vendor?.trim() || "—"}</td>
                    <td className="px-4 py-2 tabular-nums">{line.qty_requested}</td>
                    <td className="px-4 py-2 tabular-nums">{formatMoney(line.estimated_unit_cost)}</td>
                    <td className="px-4 py-2 tabular-nums">{formatMoney(line.estimated_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-right text-sm font-bold text-pulse-navy dark:text-gray-100">
            Estimated total: {formatMoney(draft.estimated_total_cost)}
          </p>
        </section>
      ) : null}
    </div>
  );
}
