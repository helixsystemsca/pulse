import type { Metadata } from "next";
import { AppLayout } from "@/components/app/AppLayout";
import { TeamManagementLayoutClient } from "@/components/team-management/TeamManagementLayoutClient";

export const metadata: Metadata = {
  title: "Team Management",
};

export default function TeamManagementLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout mainClassName="bg-ds-bg">
      <TeamManagementLayoutClient>{children}</TeamManagementLayoutClient>
    </AppLayout>
  );
}
