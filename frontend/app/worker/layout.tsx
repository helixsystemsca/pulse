import type { Metadata } from "next";
import { AppLayout } from "@/components/app/AppLayout";

export const metadata: Metadata = {
  title: { absolute: "Operations Dashboard | Panorama" },
  description: "Operations dashboard embedded in the Pulse app.",
};

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout
      mainClassName="bg-gray-50"
      pageShell={false}
      mainContentClassName="flex min-h-0 w-full flex-1 flex-col !bg-gray-50 !p-0"
    >
      {children}
    </AppLayout>
  );
}

