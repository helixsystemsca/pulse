"use client";

import { WorkRequestsApp } from "@/components/work-requests/WorkRequestsApp";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { useEffect, useState } from "react";

export default function WorkRequestsPage() {
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
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-pulse-muted">Loading…</p>
      </div>
    );
  }

  return <WorkRequestsApp />;
}
