import type { WorkRequestRow } from "@/lib/workRequestsService";

/** Format sequential tenant work order number (WO#0001). */
export function formatWorkOrderNumber(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n < 1) return null;
  return `WO#${String(Math.floor(n)).padStart(4, "0")}`;
}

/** Human-readable work order code for lists, drawers, and modals. */
export function workRequestDisplayId(
  row: Pick<WorkRequestRow, "display_id" | "work_order_number" | "id">,
): string {
  const fromApi = (row.display_id ?? "").trim();
  if (fromApi) return fromApi;
  const formatted = formatWorkOrderNumber(row.work_order_number);
  if (formatted) return formatted;
  return row.id.slice(0, 8).toUpperCase();
}
