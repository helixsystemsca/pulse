"use client";

import { ArrowLeft, Loader2, Package } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/pulse/Card";
import { QrResourceActions } from "@/components/qr/QrResourceActions";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { guestModeFromQuery } from "@/lib/qr/guest-access";
import { fetchInventoryList } from "@/lib/inventoryService";
import { inventoryScannerHref } from "@/lib/inventory-scanner/scanner-kiosk";
import { fetchPulseZonesCached } from "@/lib/pulse/pulse-reference-data";
import { filterInventoryStorageZones } from "@/lib/inventory/inventory-zones";
import { pulseAppHref } from "@/lib/pulse-app";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";

const PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2.5 text-sm font-bold");
const SECONDARY = cn(
  buttonVariants({ surface: "light", intent: "secondary" }),
  "px-4 py-2.5 text-sm font-semibold w-full sm:w-auto justify-center",
);
const BACK_BTN =
  "inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-pulse-navy shadow-sm transition-colors hover:bg-ds-interactive-hover dark:border-ds-border dark:bg-ds-primary sm:w-auto";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

type ZoneItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  inv_status: string;
};

type Props = { zoneId: string };

function statusBadgeClass(status: string): string {
  switch (status) {
    case "low_stock":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-800/50";
    case "missing":
      return "bg-rose-50 text-rose-900 ring-1 ring-rose-200/80 dark:bg-rose-900/40 dark:text-rose-100 dark:ring-rose-800/50";
    case "in_stock":
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80 dark:bg-emerald-900/40 dark:text-emerald-100 dark:ring-emerald-800/50";
    default:
      return "bg-slate-100 text-pulse-muted ring-1 ring-slate-200/80 dark:bg-ds-secondary dark:ring-ds-border";
  }
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

function ZoneItemCard({ row }: { row: ZoneItem }) {
  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-pulse-navy dark:text-gray-100">{row.name}</p>
          <p className="mt-1 truncate text-sm text-pulse-muted">{row.sku}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
            statusBadgeClass(row.inv_status),
          )}
        >
          {formatStatus(row.inv_status)}
        </span>
      </div>
      <p className="mt-3 text-sm text-pulse-muted">
        Qty{" "}
        <span className="font-semibold tabular-nums text-pulse-navy dark:text-gray-100">{row.quantity}</span>
      </p>
    </li>
  );
}

export function InventoryZoneDetailApp({ zoneId }: Props) {
  const { session } = usePulseAuth();
  const { can } = usePermissions();
  const searchParams = useSearchParams();
  const guestMode = guestModeFromQuery(searchParams.get("guest"));
  const apiCompany = session?.company_id ?? null;
  const canMutate = can("inventory.manage") && !guestMode;
  const canScan = can("inventory.scan") && !guestMode;

  const [zoneName, setZoneName] = useState("");
  const [zoneDescription, setZoneDescription] = useState<string | null>(null);
  const [items, setItems] = useState<ZoneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!apiCompany && !guestMode) return;
    setLoading(true);
    setError(null);
    try {
      const zones = filterInventoryStorageZones(await fetchPulseZonesCached(true));
      const zone = zones.find((z) => z.id === zoneId);
      if (!zone) {
        setError("Inventory zone not found.");
        setLoading(false);
        return;
      }
      setZoneName(zone.name);
      const metaDesc =
        typeof zone.meta?.description === "string" ? zone.meta.description.trim() || null : null;
      setZoneDescription(metaDesc);
      if (apiCompany) {
        const list = await fetchInventoryList({ companyId: apiCompany, zone_id: zoneId, limit: 200 });
        setItems(
          list.items.map((row) => ({
            id: row.id,
            name: row.name,
            sku: row.sku,
            quantity: row.quantity,
            inv_status: row.inv_status,
          })),
        );
      } else {
        setItems([]);
      }
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [apiCompany, guestMode, zoneId]);

  useEffect(() => {
    void load();
  }, [load]);

  const subtitle = useMemo(() => {
    const parts = [zoneDescription, guestMode ? "Guest read-only view" : null].filter(Boolean);
    return parts.join(" · ") || "Storage location";
  }, [zoneDescription, guestMode]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-pulse-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span className="text-sm">Loading zone…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <PageHeader title="Inventory zone" description="Storage location" icon={Package} />
        <Card padding="md">
          <p className="text-sm text-rose-600">{error}</p>
          <Link href={pulseAppHref("/dashboard/inventory")} className={cn(BACK_BTN, "mt-4")}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to inventory
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={zoneName} description={subtitle} icon={Package} divider={false} />
        <Link href={pulseAppHref("/dashboard/inventory")} className={BACK_BTN}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Inventory
        </Link>
      </div>

      {guestMode ? (
        <Card padding="md" variant="secondary">
          <p className="text-sm text-sky-900 dark:text-sky-100">
            Guest view — costs, vendors, and inventory mutations are hidden.
          </p>
        </Card>
      ) : (
        <Card padding="md" variant="secondary">
          <p className={LABEL}>QR code</p>
          <div className="mt-2">
            <QrResourceActions resourceType="inventory_zone" resourceId={zoneId} defaultName={zoneName} />
          </div>
        </Card>
      )}

      {!guestMode && (canScan || canMutate) ? (
        <Card padding="md">
          <p className={LABEL}>Quick actions</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canScan ? (
              <>
                <Link href={pulseAppHref(inventoryScannerHref({ mode: "issue" }))} className={SECONDARY}>
                  Issue inventory
                </Link>
                <Link href={pulseAppHref(inventoryScannerHref({ mode: "receive" }))} className={SECONDARY}>
                  Receive inventory
                </Link>
              </>
            ) : null}
            {canMutate ? (
              <Link href={pulseAppHref("/dashboard/inventory?tab=queue")} className={PRIMARY}>
                Open replenishment queue
              </Link>
            ) : null}
          </div>
        </Card>
      ) : null}

      <section className="app-data-shell min-w-0 overflow-hidden">
        <div className="border-b border-slate-200/80 px-4 py-4 dark:border-ds-border sm:px-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-pulse-muted">Items in this zone</h2>
          <p className="mt-1 text-sm text-pulse-muted">
            {items.length === 0
              ? "Nothing assigned to this location yet."
              : `${items.length} item${items.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-pulse-muted sm:px-5">No items assigned to this zone.</p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 dark:divide-ds-border md:hidden">
              {items.map((row) => (
                <ZoneItemCard key={row.id} row={row} />
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="app-table-head-row border-pulse-border">
                    <th className="px-5 py-3">Item</th>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3">Qty</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-ds-border">
                      <td className="px-5 py-3 font-medium text-pulse-navy dark:text-gray-100">{row.name}</td>
                      <td className="px-5 py-3 text-pulse-muted">{row.sku}</td>
                      <td className="px-5 py-3 tabular-nums">{row.quantity}</td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                            statusBadgeClass(row.inv_status),
                          )}
                        >
                          {formatStatus(row.inv_status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
