"use client";

import { InventoryScannerKiosk } from "@/components/inventory-scanner/InventoryScannerKiosk";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { isApiMode } from "@/lib/api";
import { isInventoryScannerOnlySession } from "@/lib/inventory-scanner/scanner-session";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { can } from "@/lib/rbac/session-access";
import { readSession } from "@/lib/pulse-session";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function InventoryScannerKioskPage() {
  const router = useRouter();
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
    if (!ready || !session) return;
    if (!can(session, "inventory.scan") && !can(session, "inventory.manage")) {
      router.replace("/overview");
    }
  }, [ready, router, session]);

  if (!ready || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f14] text-lg text-white">
        Checking access…
      </div>
    );
  }

  if (!can(session, "inventory.scan") && !can(session, "inventory.manage")) {
    return null;
  }

  return (
    <>
      {isInventoryScannerOnlySession(session) ? (
        <div className="absolute right-4 top-3 z-10 text-xs text-white/40">{session.email}</div>
      ) : null}
      <InventoryScannerKiosk />
    </>
  );
}
