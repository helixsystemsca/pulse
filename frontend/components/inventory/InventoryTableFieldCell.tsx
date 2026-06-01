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

type Props = {
  column: InventoryTableColumn;
  row: InventoryRow;
};

export function InventoryTableFieldCell({ column, row }: Props) {
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
    const qtyText = formatRegisterFieldValue(field, row);
    return (
      <td className="whitespace-nowrap px-4 py-3 align-top font-medium tabular-nums text-pulse-navy">
        {qtyText}
        {row.item_type !== "tool" && row.unit?.trim() ? (
          <span className="ml-1 text-xs font-normal text-pulse-muted">{row.unit}</span>
        ) : null}
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
