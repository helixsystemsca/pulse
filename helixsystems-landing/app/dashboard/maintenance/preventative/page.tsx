import { PreventativeMaintenanceApp } from "@/components/maintenance/PreventativeMaintenanceApp";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Preventative | Maintenance | Pulse" },
};

export default function MaintenancePreventativePage() {
  return <PreventativeMaintenanceApp />;
}
