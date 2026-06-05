/**
 * Tenant-configurable inventory reorder output types.
 * Stored under `settings.inventory.reorder_outputs`.
 */

import type { InventoryProcurementMode } from "@/lib/inventory/inventory-module-config";

export type ReorderOutputType = "material_requisition" | "email_draft" | "shopping_list";

export const REORDER_OUTPUT_TYPES: ReorderOutputType[] = [
  "material_requisition",
  "email_draft",
  "shopping_list",
];

export const DEFAULT_REORDER_OUTPUTS: ReorderOutputType[] = ["material_requisition"];

export const REORDER_OUTPUT_OPTIONS: {
  value: ReorderOutputType;
  label: string;
  description: string;
}[] = [
  {
    value: "material_requisition",
    label: "Material Requisition",
    description: "Create internal requisitions for approval.",
  },
  {
    value: "email_draft",
    label: "Email Draft",
    description: "Generate vendor email drafts for quote requests or ordering.",
  },
  {
    value: "shopping_list",
    label: "Shopping List",
    description: "Generate printable and mobile-friendly shopping lists for direct purchases.",
  },
];

const OUTPUT_SET = new Set<string>(REORDER_OUTPUT_TYPES);

const PROCUREMENT_MODE_OUTPUTS: Record<InventoryProcurementMode, ReorderOutputType[]> = {
  excel: ["material_requisition"],
  shopping_list: ["shopping_list"],
  email: ["email_draft"],
  erp: ["material_requisition"],
  manual: ["material_requisition"],
};

export function normalizeReorderOutputs(
  raw: unknown,
  procurementMode?: InventoryProcurementMode,
): ReorderOutputType[] {
  if (Array.isArray(raw) && raw.length) {
    const parsed = raw.filter((v): v is ReorderOutputType => OUTPUT_SET.has(String(v)));
    if (parsed.length) return dedupeReorderOutputs(parsed);
  }
  if (procurementMode && PROCUREMENT_MODE_OUTPUTS[procurementMode]) {
    return [...PROCUREMENT_MODE_OUTPUTS[procurementMode]];
  }
  return [...DEFAULT_REORDER_OUTPUTS];
}

export function dedupeReorderOutputs(outputs: ReorderOutputType[]): ReorderOutputType[] {
  const seen = new Set<ReorderOutputType>();
  const out: ReorderOutputType[] = [];
  for (const item of outputs) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function toggleReorderOutput(
  current: ReorderOutputType[],
  output: ReorderOutputType,
  enabled: boolean,
): ReorderOutputType[] {
  if (enabled) return dedupeReorderOutputs([...current, output]);
  const next = current.filter((v) => v !== output);
  return next.length ? next : [...DEFAULT_REORDER_OUTPUTS];
}

export function procurementModeFromReorderOutputs(outputs: ReorderOutputType[]): InventoryProcurementMode {
  if (outputs.length === 1) {
    switch (outputs[0]) {
      case "shopping_list":
        return "shopping_list";
      case "email_draft":
        return "email";
      case "material_requisition":
        return "excel";
      default:
        break;
    }
  }
  return "manual";
}

export function reorderOutputLabel(output: ReorderOutputType): string {
  return REORDER_OUTPUT_OPTIONS.find((o) => o.value === output)?.label ?? output;
}

export function reorderOutputDescription(output: ReorderOutputType): string {
  return REORDER_OUTPUT_OPTIONS.find((o) => o.value === output)?.description ?? "";
}

export function reorderOutputsLabel(outputs: ReorderOutputType[]): string {
  return outputs.map((v) => reorderOutputLabel(v)).join(", ");
}

/** Tabs shown on the replenishment queue — one per enabled reorder output plus the shared queue. */
export type ReplenishmentQueueTab = "queue" | ReorderOutputType;

export function replenishmentQueueTabs(outputs: ReorderOutputType[]): ReplenishmentQueueTab[] {
  const enabled = dedupeReorderOutputs(outputs.length ? outputs : DEFAULT_REORDER_OUTPUTS);
  return ["queue", ...enabled];
}
