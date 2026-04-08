import { AppLayout } from "@/components/app/AppLayout";
import { ZonesDevicesChrome } from "@/components/zones-devices/ZonesDevicesChrome";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Floor Plans | Pulse" },
  description: "Zone context and blueprint designer.",
};

export default function ZonesDevicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout
      mainClassName="bg-pulse-bg flex min-h-0 flex-1 flex-col"
      mainContentClassName="flex min-h-0 flex-1 flex-col"
    >
      <ZonesDevicesChrome>{children}</ZonesDevicesChrome>
    </AppLayout>
  );
}
