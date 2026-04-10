"use client";

import { WorkRequestsApp } from "@/components/work-requests/WorkRequestsApp";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";

function AuthSplash() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-pulse-muted">Loading…</p>
    </div>
  );
}

function WorkRequestsIntakeInner() {
  const [ready, setReady] = useState(false);

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

  if (!ready) {
    return <AuthSplash />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-pulse-muted">
        Submit and triage intake requests here. Approved items typically become work orders on the{" "}
        <Link href="/dashboard/maintenance/work-orders" className="font-semibold text-pulse-accent hover:underline">
          Work orders
        </Link>{" "}
        tab.
      </p>
      <WorkRequestsApp />
    </div>
  );
}

export function WorkRequestsIntakeShell() {
  return (
    <Suspense fallback={<AuthSplash />}>
      <WorkRequestsIntakeInner />
    </Suspense>
  );
}
