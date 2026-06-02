"use client";

import type { InventoryDetail } from "@/lib/inventoryService";
import type { InventoryRegisterFieldConfig } from "@/lib/inventory/register-form-config";
import { formatRegisterFieldValue } from "@/lib/inventory/inventory-list-columns";

type Props = {
  detail: InventoryDetail;
  fields: InventoryRegisterFieldConfig[];
  departmentNamesBySlug?: Record<string, string>;
};

export function InventoryItemDetailFields({ detail, fields, departmentNamesBySlug }: Props) {
  if (fields.length === 0) return null;

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-ds-border dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
      <p className="text-xs font-bold uppercase text-pulse-muted">Item details</p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {fields.map((field) => {
          const value = formatRegisterFieldValue(field, detail, departmentNamesBySlug);
          return (
            <div key={field.id} className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">{field.label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-pulse-navy break-words">{value}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
