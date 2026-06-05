import { AppLayout } from "@/components/app/AppLayout";
import { AmbientPageFrame } from "@/components/motion/AmbientPageFrame";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Inventory | Helix" },
  description: "Inventory locations, zones, and stock.",
};

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout mainClassName="bg-[#f5f7fb] dark:bg-ds-bg">
      <AmbientPageFrame>{children}</AmbientPageFrame>
    </AppLayout>
  );
}
