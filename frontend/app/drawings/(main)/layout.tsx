import { AppLayout } from "@/components/app/AppLayout";
import type { ReactNode } from "react";

export default function DrawingsShellLayout({ children }: { children: ReactNode }) {
  return (
    <AppLayout
      pageShell={false}
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden bg-pulse-bg"
      mainContentClassName="flex min-h-0 w-full flex-1 flex-col !p-0 [&_[data-tour=feature-workspace]]:flex [&_[data-tour=feature-workspace]]:min-h-0 [&_[data-tour=feature-workspace]]:flex-1 [&_[data-tour=feature-workspace]]:flex-col"
    >
      {children}
    </AppLayout>
  );
}
