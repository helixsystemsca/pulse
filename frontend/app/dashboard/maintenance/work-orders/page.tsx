import { WorkOrdersMaintenanceApp } from "@/components/maintenance/WorkOrdersMaintenanceApp";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Work orders | Maintenance | Pulse" },
};

export default function MaintenanceWorkOrdersPage() {
  return <WorkOrdersMaintenanceApp />;
}
