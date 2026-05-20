"use client";

import { Suspense, useEffect, useState } from "react";
import { ScheduleApp } from "@/components/schedule";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";

export default function SchedulePage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!readSession()) {
      navigateToPulseLogin();
      return;
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-pulse-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-sm text-pulse-muted">Loading…</div>
        }
      >
        <ScheduleApp />
      </Suspense>
    </div>
  );
}
