import { AppLayout } from "@/components/app/AppLayout";

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout
      pageShell={false}
      mainClassName="flex min-h-0 flex-1 flex-col bg-transparent"
      mainContentClassName="flex min-h-0 w-full flex-1 flex-col !p-0"
    >
      {children}
    </AppLayout>
  );
}
