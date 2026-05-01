/**
 * Legacy `/zones-devices/blueprint` editor — migration/debug only.
 *
 * - `NEXT_PUBLIC_ENABLE_LEGACY_BLUEPRINT_EDITOR=true` — opens access for everyone (short migration windows).
 * - Otherwise — **tenant admins only** (`company_admin`, `system_admin`, or `is_system_admin`).
 *
 * Optional `?legacy=true` is ignored for access control; bookmarks should rely on admin session or the env flag.
 */
import type { PulseAuthSession } from "@/lib/pulse-session";
import { sessionHasAnyRole } from "@/lib/pulse-roles";

export function isLegacyBlueprintEditorGloballyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_LEGACY_BLUEPRINT_EDITOR === "true";
}

export function isLegacyBlueprintTenantAdmin(session: PulseAuthSession | null | undefined): boolean {
  if (!session) return false;
  if (session.is_system_admin === true) return true;
  return sessionHasAnyRole(session, "system_admin", "company_admin");
}

export function canAccessLegacyBlueprintEditor(session: PulseAuthSession | null | undefined): boolean {
  if (isLegacyBlueprintEditorGloballyEnabled()) return true;
  return isLegacyBlueprintTenantAdmin(session);
}
