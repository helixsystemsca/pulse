"use client";

import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { AsyncSubmitButton } from "@/components/ui/AsyncSubmitButton";
import type { AsyncSubmitPhase } from "@/hooks/useAsyncSubmitPhase";
import {
  CheckoutModeToggle,
  stockStatusLabel,
} from "@/components/inventory-transactions/checkout-ui";
import {
  TxBubbleButton,
  TxReferenceFields,
  txBubblePrimary,
  txFieldClass,
  txLabelClass,
} from "@/components/inventory-transactions/transaction-ui";
import type { InventoryTransactionSettings } from "@/lib/inventory/transactions/settings";
import type { TransactionCartLine, TransactionMode, TransactionReference } from "@/lib/inventory/transactions/types";
import { cn } from "@/lib/cn";

type Props = {
  mode: TransactionMode;
  onModeChange: (mode: TransactionMode) => void;
  lines: TransactionCartLine[];
  onUpdateLineQty: (index: number, quantity: number) => void;
  onUpdateLineLocation: (index: number, locationId: string | null) => void;
  onRemoveLine: (index: number) => void;
  zones: { id: string; name: string }[];
  settings: InventoryTransactionSettings | null;
  batchReference: TransactionReference;
  onBatchReferenceChange: (ref: TransactionReference) => void;
  onConfirm: () => void;
  submitPhase: AsyncSubmitPhase;
  submitPending: boolean;
  className?: string;
};

export function CheckoutCartPanel({
  mode,
  onModeChange,
  lines,
  onUpdateLineQty,
  onUpdateLineLocation,
  onRemoveLine,
  zones,
  settings,
  batchReference,
  onBatchReferenceChange,
  onConfirm,
  submitPhase,
  submitPending,
  className,
}: Props) {
  const lineCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const confirmLabel =
    mode === "issue" ? `Confirm issue (${lineCount})` : `Confirm receive (${lineCount})`;

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col border-t border-ds-border bg-ds-primary/95 lg:border-l lg:border-t-0",
        className,
      )}
    >
      <div className="border-b border-ds-border/80 bg-[color-mix(in_srgb,var(--ds-accent)_8%,var(--ds-bg))] px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ds-muted">Transaction</p>
            <p className="text-sm font-semibold text-ds-foreground">
              {lines.length ? `${lines.length} item${lines.length === 1 ? "" : "s"} in cart` : "Cart empty"}
            </p>
          </div>
          <ShoppingCart className="h-5 w-5 text-ds-muted" aria-hidden />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-5">
        <CheckoutModeToggle mode={mode} onChange={onModeChange} disabled={submitPending} />

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-ds-border bg-ds-secondary/20 px-6 py-10 text-center">
            <ShoppingCart className="mb-3 h-10 w-10 text-ds-muted" strokeWidth={1.25} aria-hidden />
            <p className="text-sm font-medium text-ds-foreground">No items yet</p>
            <p className="mt-1 max-w-[16rem] text-xs text-ds-muted">
              Search or tap a material to add it here, then confirm your {mode === "issue" ? "issue" : "receive"}.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {lines.map((line, idx) => {
              const stock = stockStatusLabel(line.product);
              const zoneName = zones.find((z) => z.id === line.location_id)?.name;
              const maxQty =
                mode === "issue" && line.product.item_type !== "tool"
                  ? Math.max(1, line.product.quantity)
                  : 9999;

              return (
                <li
                  key={`${line.product.id}-${line.location_id ?? "x"}-${idx}`}
                  className="rounded-xl border border-ds-border bg-ds-primary/80 p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ds-foreground">{line.product.name}</p>
                      <p className="mt-0.5 text-xs text-ds-muted">
                        {line.product.sku}
                        {zoneName ? ` · ${zoneName}` : ""}
                      </p>
                      <span
                        className={cn(
                          "mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          stock.className,
                        )}
                      >
                        {stock.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-danger"
                      aria-label={`Remove ${line.product.name}`}
                      disabled={submitPending}
                      onClick={() => onRemoveLine(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Qty</span>
                    <div className="flex items-center gap-2">
                      <TxBubbleButton
                        type="button"
                        aria-label="Decrease quantity"
                        disabled={submitPending || line.quantity <= 1}
                        onClick={() => onUpdateLineQty(idx, line.quantity - 1)}
                        className="flex h-9 w-9 items-center justify-center !p-0"
                      >
                        <Minus className="h-4 w-4" />
                      </TxBubbleButton>
                      <span className="min-w-[2rem] text-center text-lg font-bold tabular-nums">{line.quantity}</span>
                      <TxBubbleButton
                        type="button"
                        aria-label="Increase quantity"
                        disabled={submitPending || line.quantity >= maxQty}
                        onClick={() => onUpdateLineQty(idx, line.quantity + 1)}
                        className="flex h-9 w-9 items-center justify-center !p-0"
                      >
                        <Plus className="h-4 w-4" />
                      </TxBubbleButton>
                    </div>
                  </div>
                  {settings?.enable_location_selection && zones.length > 0 ? (
                    <label className="mt-3 block">
                      <span className={txLabelClass}>
                        {mode === "issue" ? "Source location" : "Destination location"}
                      </span>
                      <select
                        className={txFieldClass}
                        disabled={submitPending}
                        value={line.location_id ?? ""}
                        onChange={(e) => onUpdateLineLocation(idx, e.target.value || null)}
                      >
                        <option value="">— Select location —</option>
                        {zones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {settings?.enable_references && lines.length > 0 ? (
          <TxReferenceFields value={batchReference} onChange={onBatchReferenceChange} disabled={submitPending} />
        ) : null}
      </div>

      <div className="shrink-0 border-t border-ds-border bg-ds-primary/95 p-4 sm:p-5">
        <AsyncSubmitButton
          phase={submitPhase}
          idleLabel={confirmLabel}
          loadingLabel="Saving…"
          disabled={submitPending || lines.length === 0}
          onClick={onConfirm}
          className={cn(txBubblePrimary, "min-h-[3.25rem] w-full px-4 py-4 text-base font-bold")}
        />
      </div>
    </section>
  );
}
