import { AppLayout } from "@/components/app/AppLayout";
import { PlanningHubLayoutClient } from "@/components/planning/PlanningHubLayoutClient";

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout mainClassName="bg-ds-bg">
      <PlanningHubLayoutClient>{children}</PlanningHubLayoutClient>
    </AppLayout>
  );
}
