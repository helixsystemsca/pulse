"use client";

import Link from "next/link";
import { usePulseAuth } from "@/hooks/usePulseAuth";
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
        <h1 className="text-lg font-semibold text-ds-foreground">No access to this workspace</h1>
        <p className="mt-2 text-sm text-ds-muted">
          Your account is not assigned to the <span className="font-mono text-ds-foreground">{departmentSlug}</span>{" "}
          department. Ask a company administrator to update your workspace assignments in Team Management.
        </p>
        <Link
          href="/overview"
          className="mt-4 inline-flex text-sm font-semibold text-[var(--ds-accent)] underline-offset-2 hover:underline"
        >
          Back to overview
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
