import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Procedures | Pulse" },
  description: "Reusable maintenance procedures with numbered steps and optional photos.",
};

export default function ProceduresLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ds-foreground">Procedures</h1>
        <p className="mt-1 text-sm text-pulse-muted">
          Build reusable checklists with numbered steps and optional reference photos for work orders and preventative
          rules.
        </p>
      </div>
      {children}
    </div>
  );
}
