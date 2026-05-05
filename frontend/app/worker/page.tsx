"use client";

import { DashboardViewTabs } from "@/components/dashboard/DashboardViewTabs";
import { WorkerDashboard } from "@/components/dashboard/WorkerBreakRoomDashboard";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { WelcomeLoaderModal } from "@/components/ui/WelcomeLoaderModal";
import { UI } from "@/styles/ui";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin, pulsePostLoginPath } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
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
    if (isApiMode() && pulsePostLoginPath(s) === "/overview") {
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
      <PageWrapper>
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className={UI.subheader}>Loading…</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="relative space-y-4">
        <DashboardViewTabs />
        <div className="pulse-dashboard-surface p-4 sm:p-5">
          <WorkerDashboard kiosk={false} />
        </div>
        <WelcomeLoaderModal userName={userName} isReady={workerShellReady} />
      </div>
    </PageWrapper>
  );
}
