"use client";

import { OperationalDashboard } from "@/components/dashboard/OperationalDashboard";
import { isApiMode } from "@/lib/api";
import { canAccessPulseTenantApis, readSession } from "@/lib/pulse-session";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { useEffect, useMemo, useState } from "react";

/** Fullscreen leadership overview — same widget grid as `/overview` (shared layout storage). */
export default function KioskLeadershipPage() {
  const [ready, setReady] = useState(false);
  const { session } = usePulseAuth();

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

  const variant = useMemo<"live" | "demo">(() => {
    if (!isApiMode()) return "demo";
    if (token) return "live";
    if (session && canAccessPulseTenantApis(session)) return "live";
    if (canAccessPulseTenantApis(readSession())) return "live";
    return "demo";
  }, [token, session]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-ds-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <OperationalDashboard variant={variant} readOnly tokenOverride={token} dashboardContext="operations" />
    </div>
  );
}
