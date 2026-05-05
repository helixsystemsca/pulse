import { AppLayout } from "@/components/app/AppLayout";
import { StandardsLayoutClient } from "@/components/standards/StandardsLayoutClient";

export default function StandardsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout mainClassName="bg-ds-bg">
      <StandardsLayoutClient>{children}</StandardsLayoutClient>
    </AppLayout>
  );
}

