"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownLeft, ArrowUpRight, Clock, Package, TrendingUp } from "lucide-react";
import type { InventoryScanProduct } from "@/lib/inventory-scanner/inventoryScannerService";
import type { TransactionMode } from "@/lib/inventory/transactions/types";
import { cn } from "@/lib/cn";
import { TxBubbleButton, txBubbleIssue, txBubbleReceive } from "@/components/inventory-transactions/transaction-ui";

export function stockStatusLabel(product: InventoryScanProduct): { label: string; className: string } {
  if (product.quantity <= 0) {
    return {
      label: "Out of stock",
      className:
        "border-[color-mix(in_srgb,var(--ds-danger)_35%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-danger)_12%,var(--ds-bg))] text-[color-mix(in_srgb,var(--ds-danger)_88%,#0f172a)]",
    };
  }
  if (product.low_stock_threshold > 0 && product.quantity <= product.low_stock_threshold) {
    return {
      label: "Low stock",
      className:
        "border-[color-mix(in_srgb,#d97706_35%,var(--ds-border))] bg-[color-mix(in_srgb,#d97706_12%,var(--ds-bg))] text-[color-mix(in_srgb,#d97706_88%,#0f172a)]",
    };
  }
  return {
    label: "In stock",
    className:
      "border-[color-mix(in_srgb,var(--ds-success)_35%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-success)_12%,var(--ds-bg))] text-[color-mix(in_srgb,var(--ds-success)_88%,#0f172a)]",
  };
}

export function CheckoutSectionLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: string;
}) {
  return (
    <div className="flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-wider text-ds-muted">
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children}
    </div>
  );
}

export function CheckoutMaterialRow({
  product,
  onSelect,
  disabled,
}: {
  product: InventoryScanProduct;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const stock = stockStatusLabel(product);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-ds-border bg-ds-primary/90 px-3 py-3 text-left",
        "transition-colors hover:border-[color-mix(in_srgb,var(--ds-accent)_35%,var(--ds-border))] hover:bg-ds-interactive-hover",
        "active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-ds-border bg-ds-secondary/60">
        <Package className="h-5 w-5 text-ds-muted" strokeWidth={1.5} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ds-foreground sm:text-base">{product.name}</span>
        <span className="mt-0.5 block truncate text-xs text-ds-muted sm:text-sm">
          {product.sku} · {product.unit}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide sm:text-[11px]",
          stock.className,
        )}
      >
        {stock.label}
      </span>
    </button>
  );
}

export function CheckoutModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: TransactionMode;
  onChange: (mode: TransactionMode) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-2 gap-2 rounded-xl border-2 border-ds-border bg-ds-secondary/40 p-1"
      role="group"
      aria-label="Transaction type"
    >
      <TxBubbleButton
        type="button"
        disabled={disabled}
        onClick={() => onChange("issue")}
        className={cn(
          "flex min-h-[2.75rem] items-center justify-center gap-2 border-0 !shadow-none px-3 py-2.5 text-sm font-bold sm:text-base",
          mode === "issue" ? txBubbleIssue : "bg-transparent opacity-80",
        )}
        aria-pressed={mode === "issue"}
      >
        <ArrowUpRight className="h-4 w-4" aria-hidden />
        Issue
      </TxBubbleButton>
      <TxBubbleButton
        type="button"
        disabled={disabled}
        onClick={() => onChange("receive")}
        className={cn(
          "flex min-h-[2.75rem] items-center justify-center gap-2 border-0 !shadow-none px-3 py-2.5 text-sm font-bold sm:text-base",
          mode === "receive" ? txBubbleReceive : "bg-transparent opacity-80",
        )}
        aria-pressed={mode === "receive"}
      >
        <ArrowDownLeft className="h-4 w-4" aria-hidden />
        Receive
      </TxBubbleButton>
    </div>
  );
}

export { Clock, TrendingUp };
