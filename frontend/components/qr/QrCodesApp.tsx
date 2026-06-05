"use client";

import { Loader2, Plus, Printer, QrCode, RefreshCw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QrPrintSheet } from "@/components/qr/QrPrintSheet";
import { QrResourceWizard } from "@/components/qr/QrResourceWizard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PremiumModal } from "@/components/ui/premium-modal";
import { usePermissions } from "@/hooks/usePermissions";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { qrResourceTypeLabel, QR_RESOURCE_TYPE_OPTIONS } from "@/lib/qr/qr-resource-types";
import {
  deleteQrResource,
  fetchQrResources,
  regenerateQrToken,
  type QrResourceRow,
} from "@/lib/qr/qrResourceService";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { qrScanHref } from "@/lib/qr/qr-scan-url";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";

const PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2.5");
const SECONDARY = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-sm font-semibold");
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

type Props = {
  /** When true, omits the page header (used inside Inventory workspace tabs). */
  embedded?: boolean;
};

export function QrCodesApp({ embedded = false }: Props) {
  const { session } = usePulseAuth();
  const { can } = usePermissions();
  const apiCompany = session?.company_id ?? null;
  const canManage = can("qr_codes.manage");

  const [rows, setRows] = useState<QrResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editRow, setEditRow] = useState<QrResourceRow | null>(null);
  const [printRow, setPrintRow] = useState<QrResourceRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchQrResources(apiCompany, {
        q: q.trim() || undefined,
        resource_type: typeFilter || undefined,
      });
      setRows(items);
    } catch (e) {
      setError(parseClientApiError(e).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiCompany, q, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => rows, [rows]);

  async function remove(id: string) {
    if (!window.confirm("Delete this QR code? Scans of the old token will stop working.")) return;
    setBusy(true);
    try {
      await deleteQrResource(apiCompany, id);
      await load();
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function regenerate(id: string) {
    setBusy(true);
    try {
      await regenerateQrToken(apiCompany, id);
      await load();
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  const generateButton = canManage ? (
    <button
      type="button"
      className={PRIMARY}
      onClick={() => {
        setEditRow(null);
        setWizardOpen(true);
      }}
    >
      <Plus className="mr-2 inline h-4 w-4" aria-hidden />
      Generate QR
    </button>
  ) : null;

  return (
    <div className="space-y-6">
      {embedded ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-pulse-muted">
            Generate, assign, and print QR codes for inventory zones and other resources.
          </p>
          {generateButton}
        </div>
      ) : (
        <PageHeader
          title="QR Codes"
          icon={QrCode}
          description="Generate, assign, and print QR codes for platform resources."
          actions={generateButton}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="min-w-[14rem] flex-1 space-y-1">
          <span className={LABEL}>Search</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-pulse-muted" />
            <input
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-ds-border dark:bg-ds-secondary"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, description, token…"
            />
          </div>
        </label>
        <label className="min-w-[12rem] space-y-1">
          <span className={LABEL}>Type</span>
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-ds-border dark:bg-ds-secondary"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            {QR_RESOURCE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-pulse-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading QR codes…
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-pulse-muted dark:border-ds-border">
          No QR codes yet. Generate one to link a resource.
        </p>
      ) : (
        <div className="app-data-shell overflow-x-auto">
          <table className="min-w-[960px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="app-table-head-row border-pulse-border">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Linked resource</th>
                <th className="px-4 py-3">Guest access</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 dark:border-ds-border">
                  <td className="px-4 py-3 font-medium text-pulse-navy dark:text-gray-100">{row.name}</td>
                  <td className="px-4 py-3 text-pulse-muted">{qrResourceTypeLabel(row.resource_type)}</td>
                  <td className="px-4 py-3 text-pulse-muted">{row.linked_resource_label ?? row.resource_id}</td>
                  <td className="px-4 py-3">
                    {row.guest_access_enabled && row.guest_access_level === "read_only" ? (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                        Read only
                      </span>
                    ) : (
                      <span className="text-pulse-muted">Off</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-pulse-muted">
                    {new Date(row.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Link href={qrScanHref(row.qr_url)} className={SECONDARY}>
                        View
                      </Link>
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            className={SECONDARY}
                            disabled={busy}
                            onClick={() => {
                              setEditRow(row);
                              setWizardOpen(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={SECONDARY}
                            disabled={busy}
                            onClick={() => setPrintRow(row)}
                          >
                            <Printer className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                            Print
                          </button>
                          <button
                            type="button"
                            className={SECONDARY}
                            disabled={busy}
                            onClick={() => void regenerate(row.id)}
                          >
                            <RefreshCw className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                            Regenerate
                          </button>
                          <button
                            type="button"
                            className={SECONDARY}
                            disabled={busy}
                            onClick={() => void remove(row.id)}
                          >
                            <Trash2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <QrResourceWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          setEditRow(null);
        }}
        apiCompany={apiCompany}
        edit={editRow}
        onSaved={() => void load()}
      />

      <PremiumModal
        open={Boolean(printRow)}
        onClose={() => setPrintRow(null)}
        title="Print QR code"
        size="md"
      >
        {printRow ? <QrPrintSheet resource={printRow} /> : null}
      </PremiumModal>
    </div>
  );
}
