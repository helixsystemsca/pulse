"use client";

import { ArrowRightLeft, MapPin } from "lucide-react";
import type { InventoryRow } from "@/lib/inventoryService";
import {
  formatRegisterFieldValue,
  type InventoryTableColumn,
} from "@/lib/inventory/inventory-list-columns";
import { cn } from "@/lib/cn";

const DEPARTMENT_PILL =
  "bg-violet-50/90 text-violet-950 ring-1 ring-violet-200/75 dark:bg-violet-900/40 dark:text-violet-100 dark:ring-violet-500/35";

function formatTs(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUnitCost(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `$${Number(value).toFixed(2)}`;
}

function statusBadge(status: string): string {
  switch (status) {
    case "assigned":
      return "bg-[#ebf8ff] text-[#3182ce] ring-1 ring-blue-200/80 dark:bg-blue-600 dark:text-white dark:ring-blue-500/40";
    case "low_stock":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80 dark:bg-amber-600 dark:text-white dark:ring-amber-400/40";
    case "missing":
      return "bg-[#fff5eb] text-[#c05621] ring-1 ring-orange-200/80 dark:bg-orange-600 dark:text-white dark:ring-orange-400/40";
    case "maintenance":
      return "bg-violet-50 text-violet-900 ring-1 ring-violet-200/75 dark:bg-violet-600 dark:text-white dark:ring-violet-400/45";
    case "in_stock":
    default:
      return "bg-sky-50/90 text-[#2B4C7E] ring-1 ring-sky-200/70 dark:bg-emerald-600 dark:text-white dark:ring-emerald-500/40";
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

type QtyCellProps = {
  row: InventoryRow;
  pending: boolean;
  canMutate: boolean;
  onUpdateQuantity: (id: string, newQuantity: number) => void;
};

const QTY_STEP_BTN =
  "inline-flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-md border border-slate-200/90 bg-white text-sm font-medium text-pulse-navy shadow-sm outline-none transition-[transform,colors] hover:bg-ds-interactive-hover active:bg-ds-interactive-active focus-visible:ring-2 focus-visible:ring-sky-400/35 active:scale-95 disabled:pointer-events-none disabled:opacity-40 dark:border-ds-border dark:bg-ds-secondary dark:hover:bg-ds-interactive-hover dark:active:bg-ds-interactive-active";

function InventoryTableQtyCell({ row, pending, canMutate, onUpdateQuantity }: QtyCellProps) {
  if (row.item_type === "tool") {
    return <span className="whitespace-nowrap font-medium text-pulse-navy">1 (tracked)</span>;
  }

  if (!canMutate) {
    return (
      <span className="whitespace-nowrap font-medium text-pulse-navy">
        {row.quantity}
        <span className="ml-1 max-w-[4.5rem] truncate text-xs text-pulse-muted" title={row.unit}>
          {row.unit}
        </span>
      </span>
    );
  }

  return (
    <div
      className="flex items-center gap-2 whitespace-nowrap"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          onUpdateQuantity(row.id, Math.max(0, row.quantity - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          onUpdateQuantity(row.id, row.quantity + 1);
        }
      }}
      tabIndex={0}
      role="group"
      aria-label={`Adjust quantity for ${row.name}`}
    >
      <button
        type="button"
        onClick={() => onUpdateQuantity(row.id, Math.max(0, row.quantity - 1))}
        disabled={pending || row.quantity <= 0 || !canMutate}
        className={QTY_STEP_BTN}
        aria-label="Decrease quantity"
      >
        -
      </button>
      <span className="min-w-[2.25rem] text-center tabular-nums font-medium text-pulse-navy">{row.quantity}</span>
      <button
        type="button"
        onClick={() => onUpdateQuantity(row.id, row.quantity + 1)}
        disabled={pending || !canMutate}
        className={QTY_STEP_BTN}
        aria-label="Increase quantity"
      >
        +
      </button>
      <span className="max-w-[4.5rem] truncate text-xs text-pulse-muted" title={row.unit}>
        {row.unit}
      </span>
    </div>
  );
}

type Props = QtyCellProps & {
  column: InventoryTableColumn;
};

export function InventoryTableFieldCell({ column, row, pending, canMutate, onUpdateQuantity }: Props) {
  if (column.kind === "type_category") {
    return (
      <td className="px-4 py-3 align-top text-pulse-navy">
        <span className="capitalize">{row.item_type}</span>
        {row.category ? (
          <>
            <br />
            <span className="text-xs text-pulse-muted">{row.category}</span>
          </>
        ) : null}
      </td>
    );
  }

  if (column.kind === "status") {
    return (
      <td className="px-4 py-3 align-top">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold capitalize",
            statusBadge(row.inv_status),
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
          {statusLabel(row.inv_status)}
        </span>
        {row.reorder_flag ? (
          <span className="mt-1 block text-[10px] font-bold uppercase text-amber-800">Reorder flagged</span>
        ) : null}
      </td>
    );
  }

  if (column.kind === "last_movement") {
    return (
      <td className="px-4 py-3 align-top text-xs text-pulse-muted">
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1">
            <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
            {formatTs(row.last_movement_at)}
          </span>
          {row.last_used_at ? <span>Used: {formatTs(row.last_used_at)}</span> : null}
        </div>
      </td>
    );
  }

  const field = column.field;

  if (field.id === "quantity") {
    return (
      <td className="px-4 py-3 align-top font-medium text-pulse-navy">
        <InventoryTableQtyCell
          row={row}
          pending={pending}
          canMutate={canMutate}
          onUpdateQuantity={onUpdateQuantity}
        />
      </td>
    );
  }

  if (field.id === "zone_id") {
    return (
      <td className="px-4 py-3 align-top">
        <span className="inline-flex items-center gap-1 text-pulse-navy">
          <MapPin className="h-3.5 w-3.5 text-[#3182ce]" aria-hidden />
          {row.location_name ?? "—"}
        </span>
      </td>
    );
  }

  if (field.id === "department_slug") {
    const label = formatRegisterFieldValue(field, row);
    return (
      <td className="px-4 py-3 align-top">
        <span
          className={cn(
            "inline-flex max-w-[11rem] truncate rounded-full px-2.5 py-0.5 text-xs font-semibold",
            DEPARTMENT_PILL,
          )}
          title={label}
        >
          {label}
        </span>
      </td>
    );
  }

  if (field.id === "unit_cost") {
    return (
      <td className="whitespace-nowrap px-4 py-3 align-top tabular-nums text-pulse-navy">
        {formatUnitCost(row.unit_cost)}
      </td>
    );
  }

  if (field.id === "vendor") {
    return (
      <td className="max-w-[12rem] px-4 py-3 align-top text-pulse-navy">
        <span className="line-clamp-2" title={row.vendor ?? undefined}>
          {formatRegisterFieldValue(field, row)}
        </span>
      </td>
    );
  }

  const text = formatRegisterFieldValue(field, row);
  return (
    <td className="max-w-[14rem] px-4 py-3 align-top text-pulse-navy">
      <span className="line-clamp-2" title={text !== "—" ? text : undefined}>
        {text}
      </span>
    </td>
  );
}
