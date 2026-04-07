import { AppLayout } from "@/components/app/AppLayout";

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout pageShell={false} mainClassName="bg-pulse-bg">
      {children}
    </AppLayout>
  );
}
