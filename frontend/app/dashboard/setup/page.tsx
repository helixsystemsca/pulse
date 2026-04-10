"use client";

import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function SetupDashboardRedirector() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "zones") {
      router.replace("/zones");
      return;
    }
    if (tab === "devices") {
      router.replace("/devices");
      return;
    }
    if (tab === "workers" || tab === "automation") {
      router.replace(`/devices?tab=${encodeURIComponent(tab)}`);
      return;
    }
    router.replace("/devices");
  }, [router, searchParams]);

  return null;
}

export default function SetupDashboardPage() {
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

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-pulse-muted">Loading…</p>
        </div>
      }
    >
      <SetupDashboardRedirector />
    </Suspense>
  );
}
