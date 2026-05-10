"use client";

import { Suspense } from "react";
import { PreventativeMaintenanceApp } from "@/components/maintenance/PreventativeMaintenanceApp";
import { WorkRequestsApp } from "@/components/work-requests/WorkRequestsApp";

export function MaintenanceWorkHub() {
  return (
    <div className="space-y-8">
      <Suspense
        fallback={
          <div className="flex min-h-[12rem] items-center justify-center rounded-md border border-ds-border bg-ds-secondary p-8 text-ds-muted">
            <p className="text-sm text-pulse-muted">Loading work requests…</p>
          </div>
        }
      >
        <WorkRequestsApp />
      </Suspense>

      <details className="group ds-premium-panel">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ds-foreground marker:content-none md:px-5 md:py-4 [&::-webkit-details-marker]:hidden">
          <span className="text-ds-muted group-open:hidden">Preventative scheduling (rules)</span>
          <span className="hidden text-ds-muted group-open:inline">Preventative scheduling — hide</span>
        </summary>
        <div className="border-t border-ds-border px-4 py-4 md:px-5 md:pb-6">
          <PreventativeMaintenanceApp />
        </div>
      </details>
    </div>
  );
}
