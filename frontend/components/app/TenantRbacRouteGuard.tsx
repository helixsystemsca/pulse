"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { TENANT_RBAC_GUARD_BYPASS_PREFIXES } from "@/lib/rbac/tenant-route-bypass";
import { canAccessClassicNavHref, firstAccessibleClassicTenantHref } from "@/lib/rbac/session-access";

function isUnguardedPath(pathname: string): boolean {
  return TENANT_RBAC_GUARD_BYPASS_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Blocks tenant product pages when `/auth/me` RBAC + contract deny the current path
 * (matches {@link canAccessClassicNavHref} used by the sidebar).
 */
export function TenantRbacRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { authed, session } = usePulseAuth();

  const skip = useMemo(() => {
    if (!authed || !session) return true;
    if (session.is_system_admin === true || session.role === "system_admin") return true;
    if (isUnguardedPath(pathname)) return true;
    return false;
  }, [authed, session, pathname]);

  const allowed = skip || canAccessClassicNavHref(session, pathname);

  useEffect(() => {
    if (skip || !session || allowed) return;
    router.replace(firstAccessibleClassicTenantHref(session));
  }, [skip, allowed, session, router, pathname]);

  if (!authed) return <>{children}</>;
  if (skip) return <>{children}</>;
  if (!allowed) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-sm font-semibold text-ds-foreground">No access</p>
        <p className="max-w-md text-xs text-ds-muted">
          You do not have permission to open this page. If you need access, ask a company administrator to update your
          role in Team Management.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
