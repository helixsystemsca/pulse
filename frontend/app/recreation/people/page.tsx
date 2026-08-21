"use client";

import { Suspense, useEffect, useState } from "react";
import { OpsModuleApp } from "@/components/recreation/OpsModuleApp";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";

function PeopleInner() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const s = readSession();
    if (!s || (isApiMode() && !s.access_token)) {
      navigateToPulseLogin();
      return;
    }
    setReady(true);
  }, []);
  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-ds-muted">Loading…</div>
    );
  }
  return <OpsModuleApp entityType="people" />;
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-ds-muted">Loading…</div>
      }
    >
      <PeopleInner />
    </Suspense>
  );
}
