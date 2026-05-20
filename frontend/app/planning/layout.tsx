import { AppLayout } from "@/components/app/AppLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Planning | Panorama" },
  description: "Portfolio planning, forecasting, and project idea intake.",
};

export default function PlanningLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout mainClassName="bg-ds-bg">{children}</AppLayout>;
}
