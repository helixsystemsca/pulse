import { AppLayout } from "@/components/app/AppLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Zones | Panorama" },
  description: "Zone and device setup.",
};

export default function ZonesLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout mainClassName="bg-pulse-bg">{children}</AppLayout>;
}
