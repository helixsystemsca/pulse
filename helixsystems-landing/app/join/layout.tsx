import { AppLayout } from "@/components/app/AppLayout";

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout pageShell={false} mainClassName="bg-pulse-bg">
      {children}
    </AppLayout>
  );
}
