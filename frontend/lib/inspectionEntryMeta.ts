import type { InspectionEquipmentOption, InspectionTemplate } from "@/lib/inspectionsLogsTypes";

/** Reserved keys stored on inspection entry `values` (not template checklist lines). */
export const INSPECTION_ENTRY_EQUIPMENT_ID = "__equipment_id__";

export function resolveInspectionEquipmentOptions(
  template: InspectionTemplate,
): InspectionEquipmentOption[] {
  const configured = template.equipment_options?.filter((o) => o.label.trim()) ?? [];
  if (configured.length > 0) {
    return configured.map((o) => ({
      id: o.id.trim() || o.label.trim(),
      label: o.label.trim(),
    }));
  }
  const legacy = template.linked_equipment_id?.trim();
  if (legacy) {
    return [{ id: legacy, label: legacy }];
  }
  return [];
}

export function equipmentLabelForEntry(
  template: InspectionTemplate,
  values: Record<string, unknown>,
): string | null {
  const id = values[INSPECTION_ENTRY_EQUIPMENT_ID];
  if (typeof id !== "string" || !id.trim()) return null;
  const match = resolveInspectionEquipmentOptions(template).find((o) => o.id === id);
  return match?.label ?? id;
}
