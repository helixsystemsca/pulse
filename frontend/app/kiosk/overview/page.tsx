"use client";

import { OperationalDashboard } from "@/components/dashboard/OperationalDashboard";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function KioskOverviewPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = readSession();
    if (!s) {
      navigateToPulseLogin();
      return;
    }
    // Kiosk view is tenant-only; system admins should use impersonation.
    if (isApiMode() && (s.is_system_admin === true || s.role === "system_admin")) {
      router.replace("/system");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-ds-muted">Loading…</p>
      </div>
    );
  }

  return <OperationalDashboard variant={isApiMode() ? "live" : "demo"} />;
}

