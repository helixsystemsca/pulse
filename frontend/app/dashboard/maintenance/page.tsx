import { MaintenanceWorkHub } from "@/components/maintenance/MaintenanceWorkHub";
import { Suspense } from "react";

export default function MaintenanceHubPage() {
  return (
    <Suspense
      fallback={<div className="rounded-md border border-ds-border bg-ds-primary p-4 text-sm text-ds-muted">Loading…</div>}
    >
      <MaintenanceWorkHub />
    </Suspense>
  );
}
