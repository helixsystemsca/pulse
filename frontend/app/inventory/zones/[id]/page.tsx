"use client";

import { InventoryZoneDetailApp } from "@/components/inventory/InventoryZoneDetailApp";
import { isApiMode } from "@/lib/api";
import { guestModeFromQuery } from "@/lib/qr/guest-access";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

export default function InventoryZonePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const zoneId = String(params.id ?? "");
  const guestMode = guestModeFromQuery(searchParams.get("guest"));
  const [ready, setReady] = useState(guestMode);

  useEffect(() => {
    if (guestMode) {
      setReady(true);
      return;
    }
    const s = readSession();
    if (!s) {
      navigateToPulseLogin(`/inventory/zones/${zoneId}`);
      return;
    }
    if (isApiMode() && !s.access_token) {
      navigateToPulseLogin(`/inventory/zones/${zoneId}`);
      return;
    }
    setReady(true);
  }, [guestMode, zoneId]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-pulse-muted">Loading…</p>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-pulse-muted">Loading…</p>
        </div>
      }
    >
      <InventoryZoneDetailApp zoneId={zoneId} />
    </Suspense>
  );
}
