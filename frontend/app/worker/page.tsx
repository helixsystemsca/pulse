"use client";

import { DashboardViewTabs } from "@/components/dashboard/DashboardViewTabs";
import { WorkerDashboard } from "@/components/dashboard/WorkerBreakRoomDashboard";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { useEffect } from "react";

export default function WorkerDashboardPage() {
  useEffect(() => {
    if (!readSession()) navigateToPulseLogin();
  }, []);
  return (
    <div className="relative">
      <DashboardViewTabs />
      <WorkerDashboard kiosk={false} />
    </div>
  );
}

