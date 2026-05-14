"use client";

import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";

export type PermissionGateProps = {
  children: ReactNode;
  /** Single permission (use with `anyOf` / `allOf` OR this, not mixed ambiguously). */
  permission?: string;
  /** User must have at least one of these RBAC keys. */
  anyOf?: readonly string[];
  /** User must have all of these RBAC keys. */
  allOf?: readonly string[];
  /** When access denied and `hide` is true, render nothing. */
  hide?: boolean;
  /** When access denied, render this instead of children. */
  fallback?: ReactNode;
  /** When access denied, still render children but non-interactive (for disabled toolbars). */
  disabled?: boolean;
  disabledClassName?: string;
};

/**
 * Centralized RBAC gate for in-page UI (`/auth/me` → `rbac_permissions`).
 * Prefer this over `sessionHasAnyRole` / `managerOrAbove` for product authorization.
 */
export function PermissionGate({
  children,
  permission,
  anyOf,
  allOf,
  hide = false,
  fallback = null,
  disabled = false,
  disabledClassName = "pointer-events-none opacity-50",
}: PermissionGateProps) {
  const { can } = usePermissions();

  let ok = true;
  if (allOf?.length) {
    ok = allOf.every((k) => can(k));
  } else if (anyOf?.length) {
    ok = anyOf.some((k) => can(k));
  } else if (permission) {
    ok = can(permission);
  }

  if (!ok && hide) return null;
  if (!ok && disabled) {
    return <span className={disabledClassName}>{children}</span>;
  }
  if (!ok) return <>{fallback}</>;
  return <>{children}</>;
}
