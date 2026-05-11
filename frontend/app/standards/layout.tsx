import type { Metadata } from "next";
import { AppLayout } from "@/components/app/AppLayout";
import { StandardsLayoutClient } from "@/components/standards/StandardsLayoutClient";

/** Fills root `title.template` (`%s | Panorama`) so the tab is not the marketing default “Helix Systems | Panorama”. */
export const metadata: Metadata = {
  title: "Standards",
};

export default function StandardsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout mainClassName="bg-ds-bg">
      <StandardsLayoutClient>{children}</StandardsLayoutClient>
    </AppLayout>
  );
}

