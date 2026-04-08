import { MaintenanceSubnav } from "@/components/maintenance/MaintenanceSubnav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Maintenance | Pulse" },
  description: "Work orders, preventative rules, and procedures.",
};

export default function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ds-foreground">Maintenance</h1>
        <p className="mt-1 text-sm text-pulse-muted">
          Unified work orders, preventative rules, reusable procedures, and optional work-request intake.
        </p>
      </div>
      <MaintenanceSubnav />
      {children}
    </div>
  );
}
