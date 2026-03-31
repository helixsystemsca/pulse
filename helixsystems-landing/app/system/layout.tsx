import { AppLayout } from "@/components/app/AppLayout";
import { SystemAppLayout } from "@/components/system/SystemAppLayout";

export default function SystemLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout mainClassName="bg-zinc-950 text-zinc-100">
      <SystemAppLayout>{children}</SystemAppLayout>
    </AppLayout>
  );
}
