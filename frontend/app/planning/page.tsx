"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlanningWorkspaceShell } from "@/components/planning/PlanningWorkspaceShell";
import { canAccessProjectManagement } from "@/lib/features/pm-project-management";
import { projectManagementPlanningHref } from "@/lib/features/planning-workspace";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";

function PlanningPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const session = readSession();
    if (!session) {
      navigateToPulseLogin();
      return;
    }
    if (canAccessProjectManagement(session)) {
      const legacyTab = searchParams.get("tab");
      const view = searchParams.get("view") ?? legacyTab;
      router.replace(projectManagementPlanningHref(view));
      return;
    }
    setReady(true);
  }, [router, searchParams]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-ds-muted">Loading…</p>
      </div>
    );
  }

  return (
    <>
      {toast ? (
        <div
          className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-ds-border bg-ds-primary px-4 py-3 text-sm font-medium text-ds-foreground shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}
      <PlanningWorkspaceShell onToast={setToast} viewQueryKey="tab" />
    </>
  );
}

export default function PlanningPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-ds-muted">Loading…</p>
        </div>
      }
    >
      <PlanningPageInner />
    </Suspense>
  );
}
