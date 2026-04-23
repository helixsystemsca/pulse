"use client";

import { OperationalDashboard } from "@/components/dashboard/OperationalDashboard";
import { isApiMode } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function KioskOverviewPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const u = new URL(window.location.href);
      const t = u.searchParams.get("token");
      return t && t.length > 10 ? t : null;
    } catch {
      return null;
    }
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-ds-muted">Loading…</p>
      </div>
    );
  }

  return (
    <OperationalDashboard
      variant={isApiMode() && token ? "live" : "demo"}
      readOnly
      tokenOverride={token}
    />
  );
}

