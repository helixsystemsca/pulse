import { ProceduresMaintenanceApp } from "@/components/maintenance/ProceduresMaintenanceApp";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Procedures | Maintenance | Pulse" },
};

export default function MaintenanceProceduresPage() {
  return <ProceduresMaintenanceApp />;
}
