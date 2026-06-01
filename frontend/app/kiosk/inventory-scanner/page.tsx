"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { InventoryScannerKiosk } from "@/components/inventory-scanner/InventoryScannerKiosk";
import { useInventoryScannerFullscreen } from "@/hooks/useInventoryScannerFullscreen";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { isApiMode } from "@/lib/api";
import { canAccessInventoryScanner, isInventoryScannerOnlySession } from "@/lib/inventory-scanner/scanner-session";
import { isInventoryScannerKioskDisplayParam } from "@/lib/inventory-scanner/scanner-kiosk";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";

function InventoryScannerKioskPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = usePulseAuth();
  const [ready, setReady] = useState(false);
  const dedicatedKiosk = isInventoryScannerOnlySession(session ?? null);
  const kioskDisplay = isInventoryScannerKioskDisplayParam(searchParams.get("kiosk"));

  useInventoryScannerFullscreen(ready && Boolean(session) && (dedicatedKiosk || kioskDisplay));

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

export default function InventoryScannerKioskPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ds-bg text-lg text-ds-muted">
          Checking access…
        </div>
      }
    >
      <InventoryScannerKioskPageInner />
    </Suspense>
  );
}
