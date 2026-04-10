import { WorkRequestsIntakeShell } from "@/components/maintenance/WorkRequestsIntakeShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Work requests | Maintenance | Pulse" },
};

export default function MaintenanceWorkRequestsPage() {
  return <WorkRequestsIntakeShell />;
}
