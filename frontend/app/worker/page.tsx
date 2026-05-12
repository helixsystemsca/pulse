"use client";

import {
  OperationalDashboard,
  type OperationalDashboardReadyPayload,
} from "@/components/dashboard/OperationalDashboard";
import { WelcomeLoaderModal } from "@/components/ui/WelcomeLoaderModal";
import { UI } from "@/styles/ui";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin, pulsePostLoginPath } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

function welcomeFromSession(email: string | null | undefined, fullName: string | null | undefined): string {
  if (fullName?.trim()) return fullName.trim();
  if (email) return email.split("@")[0] ?? email;
  return "there";
}

/**
 * Operations home: same `OperationalDashboard` experience as Leadership (`/overview`), with
 * `dashboardContext="operations"` so the header strip reads Operations and layout prefs stay separate.
 */
export default function WorkerDashboardPage() {
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
    const canSeeBoth = sessionHasAnyRole(s, "company_admin", "manager", "supervisor", "lead");
    if (isApiMode() && pulsePostLoginPath(s) === "/overview" && !canSeeBoth) {
      router.replace("/overview");
      return;
    }
    setReady(true);
  }, [router]);

  const userName = useMemo(() => {
    const s = readSession();
    return welcomeFromSession(s?.email, s?.full_name);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className={UI.subheader}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pulse-dashboard-canvas pulse-operations-dashboard space-y-4 px-2 py-4 sm:px-2 sm:py-5">
        <OperationalDashboard
          variant={isApiMode() ? "live" : "demo"}
          dashboardContext="operations"
          onReady={onDashboardReady}
        />
        <WelcomeLoaderModal
          userName={userName}
          isReady={dashboardDataReady}
          criticalCount={welcomeAlertContext.criticalCount}
          warningCount={welcomeAlertContext.warningCount}
        />
      </div>
    </div>
  );
}
