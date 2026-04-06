"use client";

import { OrganizationBrandingPanel } from "@/components/organization/OrganizationBrandingPanel";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { useEffect, useState } from "react";

export default function OrganizationBrandingPage() {
  const { authed, session } = usePulseAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authed || !session) {
      navigateToPulseLogin();
      return;
    }
    if (isApiMode() && !session.access_token) {
      navigateToPulseLogin();
      return;
    }
    setReady(true);
  }, [authed, session]);

  if (!ready || !session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-pulse-muted">Loading…</p>
      </div>
    );
  }

  if (session.role !== "company_admin") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
        Only company administrators can change organization branding.
      </div>
    );
  }

  if (!session.company) {
    return (
      <p className="text-sm text-pulse-muted">
        No organization is linked to this account.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-2">
      <div>
        <h1 className="text-xl font-semibold text-pulse-navy dark:text-slate-100">Organization</h1>
        <p className="mt-1 text-sm text-pulse-muted dark:text-gray-400">
          Name and branding for <strong className="text-pulse-navy dark:text-slate-200">{session.company.name}</strong>.
        </p>
      </div>
      <OrganizationBrandingPanel initialCompany={session.company} />
    </div>
  );
}
