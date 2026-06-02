"use client";

import { Download, Loader2, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { InventoryMaterialRequestsPanel } from "@/components/inventory/InventoryMaterialRequestsPanel";
import { InventoryVendorsPanel } from "@/components/inventory/InventoryVendorsPanel";
import { QuickPurchaseForm } from "@/components/purchasing/QuickPurchaseForm";
import { usePermissions } from "@/hooks/usePermissions";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { fetchInventorySettings } from "@/lib/inventoryService";
import { mergeInventoryModuleSettings } from "@/lib/inventory/register-form-config";
import { mergePurchasingConfig, purchasingNavItems } from "@/lib/purchasing/purchasing-module-config";
import {
  downloadExpenseExport,
  fetchPurchasingVendors,
  fetchQuickPurchases,
  purchaseReceiptUrl,
  type QuickPurchase,
  type VendorWithPerformance,
} from "@/lib/purchasing/purchasingService";
import { pulseAppHref } from "@/lib/pulse-app";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const SECONDARY = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2.5 text-sm");

type Props = {
  apiCompany: string | null;
};

export function PurchasingApp({ apiCompany }: Props) {
  const { session } = usePulseAuth();
  const { can } = usePermissions();
  const canMutate = can("inventory.manage");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("");
  const [purchases, setPurchases] = useState<QuickPurchase[]>([]);
  const [vendors, setVendors] = useState<VendorWithPerformance[]>([]);
  const [exportMonth, setExportMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const config = useMemo(() => {
    return mergePurchasingConfig({});
  }, []);

  const [purchasingConfig, setPurchasingConfig] = useState(config);

  const nav = useMemo(() => purchasingNavItems(purchasingConfig), [purchasingConfig]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const settings = await fetchInventorySettings(apiCompany);
      const merged = mergeInventoryModuleSettings(settings.settings ?? {});
      const pc = merged.purchasing;
      setPurchasingConfig(pc);
      setProcurementLabel(merged.inventory.procurement_action_label);
      const items = purchasingNavItems(pc);
      setTab((t) => (t && items.some((i) => i.id === t) ? t : items[0]?.id ?? ""));
      if (pc.enable_purchase_history || pc.enable_receipt_uploads) {
        const list = await fetchQuickPurchases(apiCompany);
        setPurchases(list.items);
      }
      if (pc.enable_vendor_tracking) {
        setVendors(await fetchPurchasingVendors(apiCompany));
      }
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [apiCompany]);

  useEffect(() => {
    void load();
  }, [load]);

  const [procurementLabel, setProcurementLabel] = useState("Export Request");

  if (!session) return null;

  if (!purchasingConfig.enabled) {
    return (
      <p className="text-sm text-pulse-muted">
        Purchasing is disabled. Enable it in{" "}
        <Link href={pulseAppHref("/dashboard/inventory")} className="font-semibold underline">
          Inventory settings
        </Link>{" "}
        (setup wizard).
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={purchasingConfig.purchasing_label}
        icon={ShoppingCart}
        actions={
          purchasingConfig.enable_monthly_expense_exports ? (
            <button
              type="button"
              className={SECONDARY}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const blob = await downloadExpenseExport(apiCompany, { month: exportMonth });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `expenses-${exportMonth}.xlsx`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  setErr(parseClientApiError(e).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Download className="mr-2 inline h-4 w-4" />
              Monthly export
            </button>
          ) : null
        }
      />

      {err ? <p className="text-sm text-rose-600">{err}</p> : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-pulse-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 rounded-lg border border-pulse-border bg-white p-1 dark:border-ds-border dark:bg-ds-primary">
            {nav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-semibold transition",
                  tab === item.id
                    ? "bg-ds-accent text-ds-accent-foreground"
                    : "text-pulse-muted hover:bg-ds-interactive-hover",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "replenishment" && purchasingConfig.enable_replenishment_requests ? (
            <InventoryMaterialRequestsPanel
              apiCompany={apiCompany}
              canMutate={canMutate}
              procurementActionLabel={procurementLabel}
              replenishmentLabel={purchasingConfig.replenishment_label}
            />
          ) : null}

          {tab === "quick" && purchasingConfig.enable_quick_purchases ? (
            <QuickPurchaseForm
              apiCompany={apiCompany}
              config={purchasingConfig}
              vendors={vendors}
              onSaved={() => void load()}
            />
          ) : null}

          {tab === "vendors" && purchasingConfig.enable_vendor_tracking ? (
            <div className="space-y-6">
              {vendors.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-pulse-border dark:border-ds-border">
                  <table className="min-w-[640px] w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-pulse-border bg-slate-50 dark:border-ds-border dark:bg-ds-secondary">
                        <th className="px-4 py-2">Vendor</th>
                        <th className="px-4 py-2">Purchases</th>
                        <th className="px-4 py-2">Last purchase</th>
                        <th className="px-4 py-2">Avg amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendors.map((v) => (
                        <tr key={v.id} className="border-b border-slate-100 dark:border-ds-border">
                          <td className="px-4 py-2 font-semibold">{v.name}</td>
                          <td className="px-4 py-2 tabular-nums">{v.total_purchases}</td>
                          <td className="px-4 py-2">{v.last_purchase_date ?? "—"}</td>
                          <td className="px-4 py-2 tabular-nums">
                            {v.average_purchase_value != null
                              ? `$${v.average_purchase_value.toFixed(2)}`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <InventoryVendorsPanel apiCompany={apiCompany} />
            </div>
          ) : null}

          {tab === "receipts" && purchasingConfig.enable_receipt_uploads ? (
            <div className="space-y-3">
              <p className="text-sm text-pulse-muted">Receipts linked to quick purchases.</p>
              <ul className="space-y-2">
                {purchases
                  .filter((p) => p.has_receipt)
                  .map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-pulse-border px-4 py-3 dark:border-ds-border"
                    >
                      <span>
                        {p.vendor_name} · ${p.total_amount.toFixed(2)} · {p.purchase_date}
                      </span>
                      <a
                        className="text-sm font-semibold text-[#2B4C7E] underline dark:text-ds-accent"
                        href={purchaseReceiptUrl(apiCompany, p.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {p.receipt_filename ?? "View receipt"}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          {tab === "history" && purchasingConfig.enable_purchase_history ? (
            <div className="overflow-x-auto rounded-xl border border-pulse-border dark:border-ds-border">
              <table className="min-w-[720px] w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-pulse-border bg-slate-50 dark:border-ds-border dark:bg-ds-secondary">
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Vendor</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Items</th>
                    <th className="px-4 py-2">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 dark:border-ds-border">
                      <td className="px-4 py-2">{p.purchase_date}</td>
                      <td className="px-4 py-2">{p.vendor_name}</td>
                      <td className="px-4 py-2 tabular-nums">${p.total_amount.toFixed(2)}</td>
                      <td className="px-4 py-2 text-pulse-muted">
                        {p.lines.map((l) => l.name).join(", ")}
                      </td>
                      <td className="px-4 py-2">{p.has_receipt ? "Yes" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
