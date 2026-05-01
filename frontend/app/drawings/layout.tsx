import { AppLayout } from "@/components/app/AppLayout";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Drawings | Pulse" },
  description: "Multi-system infrastructure overlays on facility maps.",
};

export default function DrawingsLayout({ children }: { children: ReactNode }) {
  return <AppLayout mainClassName="bg-pulse-bg">{children}</AppLayout>;
}
