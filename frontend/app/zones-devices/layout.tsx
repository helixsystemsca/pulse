import { AppLayout } from "@/components/app/AppLayout";
import { ZonesDevicesChrome } from "@/components/zones-devices/ZonesDevicesChrome";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Floor Plans | Panorama" },
  description: "Zone context and floor plan previews.",
};

export default function ZonesDevicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout mainClassName="bg-pulse-bg">
      <ZonesDevicesChrome>{children}</ZonesDevicesChrome>
    </AppLayout>
  );
}
