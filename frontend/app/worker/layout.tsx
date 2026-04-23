import type { Metadata } from "next";
import { AppLayout } from "@/components/app/AppLayout";

export const metadata: Metadata = {
  title: { absolute: "Worker Dashboard | Pulse" },
  description: "Worker dashboard embedded in the Pulse app.",
};

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout mainClassName="bg-dashboard-canvas">{children}</AppLayout>;
}

