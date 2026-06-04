"use client";

import { ArrowLeft, Loader2, Package } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
const SECONDARY = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2.5 text-sm font-semibold");

type Props = { zoneId: string };

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
  const [items, setItems] = useState<
    { id: string; name: string; sku: string; quantity: number; inv_status: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!apiCompany) return;
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
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [apiCompany, zoneId]);

  useEffect(() => {
    void load();
  }, [load]);

  const subtitle = useMemo(() => {
    const parts = [zoneDescription, guestMode ? "Guest read-only view" : null].filter(Boolean);
    return parts.join(" · ") || "Inventory zone";
  }, [zoneDescription, guestMode]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-pulse-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading zone…
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <Link href={pulseAppHref("/dashboard/inventory")} className="inline-flex items-center gap-1 text-sm font-semibold text-[#2B4C7E] hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Inventory
      </Link>

      <PageHeader title={zoneName} description={subtitle} icon={Package} />

      {!guestMode ? (
        <QrResourceActions resourceType="inventory_zone" resourceId={zoneId} defaultName={zoneName} />
      ) : (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100">
          Guest view — costs, vendors, and inventory mutations are hidden.
        </p>
      )}

      {!guestMode && (canScan || canMutate) ? (
        <div className="flex flex-wrap gap-2">
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
            <Link href={pulseAppHref("/dashboard/inventory")} className={PRIMARY}>
              Generate reorder package
            </Link>
          ) : null}
        </div>
      ) : null}

      <section className="app-data-shell overflow-x-auto">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-pulse-muted">Items in this zone</h2>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-pulse-muted">No items assigned to this zone.</p>
        ) : (
          <table className="min-w-[640px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="app-table-head-row border-pulse-border">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 dark:border-ds-border">
                  <td className="px-4 py-3 font-medium text-pulse-navy dark:text-gray-100">{row.name}</td>
                  <td className="px-4 py-3 text-pulse-muted">{row.sku}</td>
                  <td className="px-4 py-3 tabular-nums">{row.quantity}</td>
                  <td className="px-4 py-3 capitalize text-pulse-muted">{row.inv_status.replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
