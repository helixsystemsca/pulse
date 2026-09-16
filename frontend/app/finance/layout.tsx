import { AppLayout } from "@/components/app/AppLayout";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "Financial & Asset Planning | Helix" },
  description:
    "Municipal recreation budgeting, asset lifecycle, maintenance, procurement, and capital planning.",
};

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return <AppLayout mainClassName="bg-ds-bg">{children}</AppLayout>;
}
