import { AppLayout } from "@/components/app/AppLayout";
import { AmbientPageFrame } from "@/components/motion/AmbientPageFrame";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Monitoring | Panorama" },
  description: "Real-time visibility into people and facility systems.",
};

export default function MonitoringLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout mainClassName="bg-pulse-bg">
      <AmbientPageFrame>{children}</AmbientPageFrame>
    </AppLayout>
  );
}
