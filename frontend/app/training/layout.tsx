import type { Metadata } from "next";
import { AppLayout } from "@/components/app/AppLayout";
import { StandardsLayoutClient } from "@/components/standards/StandardsLayoutClient";

export const metadata: Metadata = {
  title: "Training",
};

export default function TrainingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout mainClassName="bg-ds-bg">
      <StandardsLayoutClient>{children}</StandardsLayoutClient>
    </AppLayout>
  );
}
