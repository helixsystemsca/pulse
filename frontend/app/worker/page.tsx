"use client";

import { WorkerDashboard } from "@/components/dashboard/WorkerBreakRoomDashboard";
import { WelcomeLoaderModal } from "@/components/ui/WelcomeLoaderModal";
import { UI } from "@/styles/ui";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin, pulsePostLoginPath } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function welcomeFromSession(email: string | null | undefined, fullName: string | null | undefined): string {
  if (fullName?.trim()) return fullName.trim();
  if (email) return email.split("@")[0] ?? email;
  return "there";
}

export default function WorkerDashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [workerShellReady, setWorkerShellReady] = useState(false);

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

  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setWorkerShellReady(true), 500);
    return () => window.clearTimeout(t);
  }, [ready]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className={UI.subheader}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pulse-dashboard-canvas space-y-4 px-2 py-4 sm:px-2 sm:py-5">
        <WorkerDashboard kiosk={false} />
        <WelcomeLoaderModal userName={userName} isReady={workerShellReady} />
      </div>
    </div>
  );
}
