import { AppLayout } from "@/components/app/AppLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Projects | Panorama" },
  description: "Projects, tasks, and schedule-linked due dates for Pulse.",
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout mainClassName="bg-pulse-bg">{children}</AppLayout>;
}
