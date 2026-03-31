"use client";

import { OperationalDashboard } from "@/components/dashboard/OperationalDashboard";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { isApiMode } from "@/lib/api";
import { pulseRoutes } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function OverviewPage() {
  const router = useRouter();
  const { session } = usePulseAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = readSession();
    if (!s) {
      router.replace(pulseRoutes.login);
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

  const showSystemLink =
    isApiMode() && Boolean(session?.is_system_admin || session?.role === "system_admin");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <OperationalDashboard variant={isApiMode() ? "live" : "demo"} />
      {showSystemLink ? (
        <div className="mt-6 flex justify-center">
          <Link
            href="/system"
            className="inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-slate-800"
          >
            System admin
          </Link>
        </div>
      ) : null}
    </div>
  );
}
