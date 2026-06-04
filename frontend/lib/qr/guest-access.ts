/** Client-side guest read-only mode helpers (mirrors backend checks). */

export const GUEST_BLOCKED_ACTIONS = [
  "create",
  "edit",
  "delete",
  "issue_inventory",
  "receive_inventory",
  "generate_reorder_package",
  "view_costs",
  "view_vendors",
  "view_purchase_history",
  "view_internal_notes",
] as const;

export type GuestBlockedAction = (typeof GUEST_BLOCKED_ACTIONS)[number];

export function guestModeFromQuery(value: string | null): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "guest"].includes(value.trim().toLowerCase());
}

export function guestMayPerform(action: GuestBlockedAction): boolean {
  return !GUEST_BLOCKED_ACTIONS.includes(action);
}
