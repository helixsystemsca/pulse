"use client";

import { WorkerDashboard } from "@/components/dashboard/WorkerBreakRoomDashboard";

export default function WorkerKioskPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <WorkerDashboard kiosk />
    </div>
  );
}

