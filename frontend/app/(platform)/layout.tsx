import { AppLayout } from "@/components/app/AppLayout";
import { AmbientPageFrame } from "@/components/motion/AmbientPageFrame";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { template: "%s | Workspaces | Panorama", default: "Workspaces" },
  description: "Department-scoped operational workspaces.",
};

export default function PlatformRouteGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout mainClassName="bg-ds-bg">
      <AmbientPageFrame>{children}</AmbientPageFrame>
    </AppLayout>
  );
}
