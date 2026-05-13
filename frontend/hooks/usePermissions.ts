"use client";

import { useMemo } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";

/**
 * Central RBAC helper: `/auth/me` → `rbac_permissions` (flat keys) + optional `*`.
 * Use for UI and route guards; do not branch on JWT role or department slug for visibility.
 */
export function usePermissions() {
  const { session } = usePulseAuth();
  const keys = useMemo(() => {
    const raw = session?.rbac_permissions;
    if (!raw?.length) return new Set<string>();
    return new Set(raw);
  }, [session?.rbac_permissions]);

  const can = useMemo(
    () => (permissionKey: string) => keys.has("*") || keys.has(permissionKey),
    [keys],
  );

  return { can, keys };
}
