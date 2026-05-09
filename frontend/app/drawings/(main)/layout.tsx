import { AppLayout } from "@/components/app/AppLayout";
import type { ReactNode } from "react";

export default function DrawingsShellLayout({ children }: { children: ReactNode }) {
  return (
    <AppLayout
      mainClassName="bg-pulse-bg"
      mainContentClassName="flex min-h-0 flex-col !px-0 !pb-0 !pt-4 lg:!pt-5"
    >
      {children}
    </AppLayout>
  );
}
