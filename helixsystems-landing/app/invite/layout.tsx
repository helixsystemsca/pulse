import { AppLayout } from "@/components/app/AppLayout";

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout mainClassName="bg-pulse-bg">{children}</AppLayout>;
}
