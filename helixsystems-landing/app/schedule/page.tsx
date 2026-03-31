"use client";

import { ScheduleApp } from "@/components/schedule";
import { pulseRoutes } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SchedulePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!readSession()) {
      router.replace(pulseRoutes.login);
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-pulse-muted">
        Loading…
      </div>
    );
  }

  return <ScheduleApp />;
}
