import { AppLayout } from "@/components/app/AppLayout";
import { PlanningHubLayoutClient } from "@/components/planning/PlanningHubLayoutClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Planning | Helix" },
  description: "Portfolio planning, forecasting, and project idea intake.",
};

export default function PlanningLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout mainClassName="bg-ds-bg">
      <PlanningHubLayoutClient>{children}</PlanningHubLayoutClient>
    </AppLayout>
  );
}
