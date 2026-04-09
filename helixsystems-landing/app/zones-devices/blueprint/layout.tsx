import { AppLayout } from "@/components/app/AppLayout";
import { ZonesDevicesChrome } from "@/components/zones-devices/ZonesDevicesChrome";

export default function ZonesDevicesBlueprintLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout
      pageShell={false}
      mainClassName="flex min-h-0 flex-1 flex-col bg-pulse-bg"
      mainContentClassName="mx-0 flex min-h-0 w-full max-w-none flex-1 flex-col px-4 py-5 sm:px-5 sm:py-6 md:py-7"
    >
      <ZonesDevicesChrome>{children}</ZonesDevicesChrome>
    </AppLayout>
  );
}

