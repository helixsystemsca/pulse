import { AppLayout } from "@/components/app/AppLayout";
import type { ReactNode } from "react";

export default function DrawingsShellLayout({ children }: { children: ReactNode }) {
  return (
    <AppLayout mainClassName="bg-pulse-bg" mainContentClassName="!p-0 flex min-h-0 flex-col">
      {children}
    </AppLayout>
  );
}
