"use client";

import Link from "next/link";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { firstAccessibleClassicTenantHref } from "@/lib/rbac/session-access";
import { userMayAccessDepartmentWorkspace } from "@/lib/workspace-access";

export function DepartmentWorkspaceAccessGate({
  departmentSlug,
  children,
}: {
  departmentSlug: string;
  children: React.ReactNode;
}) {
  const { session } = usePulseAuth();
  if (!userMayAccessDepartmentWorkspace(session, departmentSlug)) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-ds-border bg-ds-primary p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-ds-foreground">No access to this area</h1>
        <p className="mt-2 text-sm text-ds-muted">
          Your role does not include permission to open this department hub, or the contract does not include the
          required modules. Ask a company administrator to adjust your tenant role and grants in Team Management.
        </p>
        <Link
          href={session ? firstAccessibleClassicTenantHref(session) : "/settings"}
          className="mt-4 inline-flex text-sm font-semibold text-[var(--ds-accent)] underline-offset-2 hover:underline"
        >
          Back to Pulse
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
