import type { PulseAuthSession } from "@/lib/pulse-session";
import { hasRbacPermission } from "@/lib/rbac/session-access";

/** Tablet scanner kiosk account — scan permission without full inventory UI access. */
export function isInventoryScannerOnlySession(session: PulseAuthSession | null): boolean {
  if (!session) return false;
  if (!hasRbacPermission(session, "inventory.scan")) return false;
  if (hasRbacPermission(session, "inventory.view") || hasRbacPermission(session, "inventory.manage")) {
    return false;
  }
  return true;
}
