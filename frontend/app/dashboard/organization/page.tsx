"use client";

import { OrganizationBrandingPanel } from "@/components/organization/OrganizationBrandingPanel";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

export default function OrganizationBrandingPage() {
  const { session } = usePulseAuth();
  const [ready, setReady] = useState(false);

  /** Guard on synchronous `readSession()` — `usePulseAuth` is null until its effect runs, so a login redirect would wrongly fire and bounce to `/overview`. */
  useEffect(() => {
    const s = readSession();
    if (!s) {
      navigateToPulseLogin();
      return;
    }
    if (isApiMode() && !s.access_token) {
      navigateToPulseLogin();
      return;
    }
    setReady(true);
  }, []);

  const effective = session ?? readSession();

  if (!ready || !effective) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-pulse-muted">Loading…</p>
      </div>
    );
  }

  if (!sessionHasAnyRole(effective, "company_admin")) {
    return (
      <div className="ds-notification ds-notification-warning flex gap-3 p-4 text-sm text-ds-foreground">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-ds-warning" aria-hidden />
        <p>Only company administrators can change organization branding.</p>
      </div>
    );
  }

  if (!effective.company) {
    return (
      <p className="text-sm text-pulse-muted">
        No organization is linked to this account.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-2">
      <div>
        <h1 className="text-xl font-semibold text-ds-foreground">Organization</h1>
        <p className="mt-1 text-sm text-ds-muted">
          Name and branding for{" "}
          <strong className="text-ds-foreground">{effective.company.name}</strong>.
        </p>
      </div>
      <OrganizationBrandingPanel initialCompany={effective.company} />
    </div>
  );
}
