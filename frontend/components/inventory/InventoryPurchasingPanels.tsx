"use client";

import { InventoryVendorsPanel } from "@/components/inventory/InventoryVendorsPanel";
import { QuickPurchaseForm } from "@/components/purchasing/QuickPurchaseForm";
import type { PurchasingModuleConfig } from "@/lib/purchasing/purchasing-module-config";
import {
  purchaseReceiptUrl,
  type QuickPurchase,
  type VendorWithPerformance,
} from "@/lib/purchasing/purchasingService";

type Props = {
  apiCompany: string | null;
  tab: "quick_purchase" | "receipts" | "history" | "vendors";
  config: PurchasingModuleConfig;
  purchases: QuickPurchase[];
  vendors: VendorWithPerformance[];
  onPurchaseSaved: () => void;
};

export function InventoryPurchasingPanels({
  apiCompany,
  tab,
  config,
  purchases,
  vendors,
  onPurchaseSaved,
}: Props) {
  if (tab === "quick_purchase" && config.enable_quick_purchases) {
    return (
      <QuickPurchaseForm
        apiCompany={apiCompany}
        config={config}
        vendors={vendors}
        onSaved={onPurchaseSaved}
      />
    );
  }

  if (tab === "vendors" && config.enable_vendor_tracking) {
    return (
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
                      {v.average_purchase_value != null ? `$${v.average_purchase_value.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <InventoryVendorsPanel apiCompany={apiCompany} />
      </div>
    );
  }

  if (tab === "receipts" && config.enable_receipt_uploads) {
    return (
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
        {purchases.filter((p) => p.has_receipt).length === 0 ? (
          <p className="text-sm text-pulse-muted">No receipts uploaded yet.</p>
        ) : null}
      </div>
    );
  }

  if (tab === "history" && config.enable_purchase_history) {
    return (
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
                <td className="px-4 py-2 text-pulse-muted">{p.lines.map((l) => l.name).join(", ")}</td>
                <td className="px-4 py-2">{p.has_receipt ? "Yes" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {purchases.length === 0 ? (
          <p className="p-4 text-sm text-pulse-muted">No purchase history yet.</p>
        ) : null}
      </div>
    );
  }

  return null;
}
