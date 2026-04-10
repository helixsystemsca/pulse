"use client";

import {
  OperationalDashboard,
  type OperationalDashboardReadyPayload,
} from "@/components/dashboard/OperationalDashboard";
import { WelcomeLoaderModal } from "@/components/ui/WelcomeLoaderModal";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin, pulsePostLoginPath } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

function welcomeFromSession(email: string | null | undefined, fullName: string | null | undefined): string {
  if (fullName?.trim()) return fullName.trim();
  if (email) return email.split("@")[0] ?? email;
  return "there";
}

/**
 * Pulse operations overview: main dashboard after login.
 *
 * `dashboardDataReady` becomes true when `OperationalDashboard` finishes its first load
 * (live API bundle or demo mount). That drives the welcome overlay without blocking render.
 */
export default function OverviewPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [dashboardDataReady, setDashboardDataReady] = useState(false);
  const [welcomeAlertContext, setWelcomeAlertContext] = useState<OperationalDashboardReadyPayload>({
    criticalCount: 0,
    warningCount: 0,
  });
  const onDashboardReady = useCallback((payload?: OperationalDashboardReadyPayload) => {
    setWelcomeAlertContext(payload ?? { criticalCount: 0, warningCount: 0 });
    setDashboardDataReady(true);
  }, []);

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

  const userName = useMemo(() => {
    const s = readSession();
    return welcomeFromSession(s?.email, s?.full_name);
  }, [ready]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-ds-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <OperationalDashboard
        variant={isApiMode() ? "live" : "demo"}
        onReady={onDashboardReady}
      />
      <WelcomeLoaderModal
        userName={userName}
        isReady={dashboardDataReady}
        criticalCount={welcomeAlertContext.criticalCount}
        warningCount={welcomeAlertContext.warningCount}
      />
    </div>
  );
}
