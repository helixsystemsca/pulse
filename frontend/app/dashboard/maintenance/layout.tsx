import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Work Requests | Panorama" },
  description: "Work request hub — triage, categories, and preventative scheduling.",
};

export default function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ds-foreground">Work Requests</h1>
        <p className="mt-1 text-sm text-pulse-muted">
          Central hub for intake, assignments, and status — with optional preventative rules. Reusable procedures live
          under <span className="font-medium text-ds-foreground">Procedures</span> in the sidebar.
        </p>
      </div>
      {children}
    </div>
  );
}
