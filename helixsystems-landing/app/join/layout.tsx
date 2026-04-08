import { AppLayout } from "@/components/app/AppLayout";

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout
      pageShell={false}
      mainClassName="flex min-h-0 flex-1 flex-col bg-transparent"
      mainContentClassName="mx-0 flex min-h-0 w-full max-w-none flex-1 flex-col px-0 py-0 sm:px-0 sm:py-0 md:py-0"
    >
      {children}
    </AppLayout>
  );
}
