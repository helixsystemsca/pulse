"use client";

import { Suspense } from "react";
import { OperationalImprovementsApp } from "@/components/operational-improvements/OperationalImprovementsApp";

export default function OperationalImprovementsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-ds-muted">Loading…</p>
        </div>
      }
    >
      <OperationalImprovementsApp />
    </Suspense>
  );
}
