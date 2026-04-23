import type { Metadata } from "next";
import { AppLayout } from "@/components/app/AppLayout";

export const metadata: Metadata = {
  title: { absolute: "Kiosk | Pulse" },
  description: "Fullscreen kiosk views for external displays.",
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout chrome={false} pageShell={false} mainClassName="bg-dashboard-canvas">
      {children}
    </AppLayout>
  );
}

