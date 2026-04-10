import { AppLayout } from "@/components/app/AppLayout";
import { SystemAppLayout } from "@/components/system/SystemAppLayout";

export default function SystemLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout mainClassName="bg-pulse-bg">
      <SystemAppLayout>{children}</SystemAppLayout>
    </AppLayout>
  );
}
