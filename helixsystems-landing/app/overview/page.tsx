"use client";

import { OperationalDashboard } from "@/components/dashboard/OperationalDashboard";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin, pulsePostLoginPath } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function OverviewPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = readSession();
    if (!s) {
      navigateToPulseLogin();
      return;
    }
    if (isApiMode() && pulsePostLoginPath(s) === "/system") {
      router.replace("/system");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-pulse-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <OperationalDashboard variant={isApiMode() ? "live" : "demo"} />
    </div>
  );
}
