import { AppLayout } from "@/components/app/AppLayout";
import { AmbientPageFrame } from "@/components/motion/AmbientPageFrame";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Equipment | Panorama" },
  description: "Manage and monitor facility equipment.",
};

export default function EquipmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout mainClassName="bg-pulse-bg">
      <AmbientPageFrame>{children}</AmbientPageFrame>
    </AppLayout>
  );
}
