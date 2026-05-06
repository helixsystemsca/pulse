"use client";

import { DashboardViewTabs } from "@/components/dashboard/DashboardViewTabs";
import { OperationalDashboard } from "@/components/dashboard/OperationalDashboard";
import { UI } from "@/styles/ui";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin, pulsePostLoginPath } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function OverviewAdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = readSession();
    if (!s) {
      navigateToPulseLogin();
      return;
    }
    if (!sessionHasAnyRole(s, "company_admin", "system_admin")) {
      router.replace("/overview");
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
        <p className={UI.subheader}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pulse-dashboard-canvas -mx-3 space-y-4 px-3 py-4 sm:-mx-4 sm:px-4 sm:py-5 lg:-mx-4 lg:px-4">
        <DashboardViewTabs />
        <OperationalDashboard variant={isApiMode() ? "live" : "demo"} dashboardContext="admin" />
      </div>
    </div>
  );
}

