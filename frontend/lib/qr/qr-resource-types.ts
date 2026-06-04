/** QR-linkable resource types (mirrors backend registry). */

export type QrResourceType =
  | "inventory_zone"
  | "location"
  | "room"
  | "cabinet"
  | "fridge"
  | "equipment"
  | "vehicle"
  | "procedure"
  | "drawing";

export type QrGuestAccessLevel = "none" | "read_only";

export const QR_RESOURCE_TYPE_OPTIONS: { value: QrResourceType; label: string }[] = [
  { value: "inventory_zone", label: "Inventory Zone" },
  { value: "location", label: "Storage Location" },
  { value: "room", label: "Room" },
  { value: "cabinet", label: "Cabinet" },
  { value: "fridge", label: "Fridge" },
  { value: "equipment", label: "Equipment" },
  { value: "vehicle", label: "Vehicle" },
  { value: "procedure", label: "Procedure" },
  { value: "drawing", label: "Drawing" },
];

export function qrResourceTypeLabel(type: string): string {
  return QR_RESOURCE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}
