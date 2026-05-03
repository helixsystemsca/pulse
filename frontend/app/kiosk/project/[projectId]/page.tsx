"use client";

import { ProjectKioskDisplay } from "@/components/project-kiosk/ProjectKioskDisplay";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin, pulseApp } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function KioskProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.projectId === "string" ? params.projectId : "";
  const { session } = usePulseAuth();
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

  useEffect(() => {
    if (!ready) return;
    if (!session?.can_use_pm_features) {
      router.replace(pulseApp.to("/overview"));
    }
  }, [ready, router, session?.can_use_pm_features]);

  if (!ready || !session?.can_use_pm_features) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-lg text-white">
        Checking access…
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-lg text-white">
        Invalid project.
      </div>
    );
  }

  return <ProjectKioskDisplay projectId={projectId} />;
}
