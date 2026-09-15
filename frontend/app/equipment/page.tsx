"use client";

import { Suspense, useEffect, useState } from "react";
import { EquipmentApp } from "@/components/equipment/EquipmentApp";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";

function EquipmentPageInner() {
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

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-pulse-muted">Loading…</p>
      </div>
    );
  }

  return <EquipmentApp />;
}

export default function EquipmentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-pulse-muted">Loading…</p>
        </div>
      }
    >
      <EquipmentPageInner />
    </Suspense>
  );
}
