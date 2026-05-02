import { AppLayout } from "@/components/app/AppLayout";
import type { ReactNode } from "react";

export default function DrawingsShellLayout({ children }: { children: ReactNode }) {
  return <AppLayout mainClassName="bg-pulse-bg">{children}</AppLayout>;
}
