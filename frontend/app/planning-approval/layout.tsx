import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Planning approval | Helix" },
  description: "Review and approve a planning idea.",
  robots: { index: false, follow: false },
};

export default function PlanningApprovalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ds-bg text-ds-foreground">
      {children}
    </div>
  );
}
