"use client";

import { WorkRequestsApp } from "@/components/work-requests/WorkRequestsApp";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { Suspense, useEffect, useState } from "react";

function AuthSplash() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-pulse-muted">Loading…</p>
    </div>
  );
}

function WorkRequestsInner() {
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

  return <WorkRequestsApp />;
}

export default function WorkRequestsPage() {
  return (
    <Suspense fallback={<AuthSplash />}>
      <WorkRequestsInner />
    </Suspense>
  );
}
