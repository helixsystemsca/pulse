/**
 * PM planning routes — same authenticated shell as other product areas.
 */
import { AppLayout } from "@/components/app/AppLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "PM Planning | Pulse" },
  description: "Internal project planning views (Gantt, network, resources, critical path).",
};

export default function PmLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout mainClassName="bg-ds-bg">{children}</AppLayout>;
}
