"use client";

import { InventoryScannerKiosk } from "@/components/inventory-scanner/InventoryScannerKiosk";
import { useInventoryScannerFullscreen } from "@/hooks/useInventoryScannerFullscreen";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { isApiMode } from "@/lib/api";
import { canAccessInventoryScanner, isInventoryScannerOnlySession } from "@/lib/inventory-scanner/scanner-session";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function InventoryScannerKioskPage() {
  const router = useRouter();
  const { session } = usePulseAuth();
  const [ready, setReady] = useState(false);
  const dedicatedKiosk = isInventoryScannerOnlySession(session ?? null);

  useInventoryScannerFullscreen(ready && Boolean(session));

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
    if (!canAccessInventoryScanner(session)) {
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

  if (!canAccessInventoryScanner(session)) {
    return null;
  }

  return <InventoryScannerKiosk presentation={dedicatedKiosk ? "dedicated" : "staff"} />;
}
