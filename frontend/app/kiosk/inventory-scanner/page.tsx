"use client";

import { InventoryScannerKiosk } from "@/components/inventory-scanner/InventoryScannerKiosk";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { isApiMode } from "@/lib/api";
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
      <div className="flex min-h-screen items-center justify-center bg-ds-bg text-lg text-ds-muted">
        Checking access…
      </div>
    );
  }

  if (!can(session, "inventory.scan") && !can(session, "inventory.manage")) {
    return null;
  }

  return <InventoryScannerKiosk />;
}
