import { AppLayout } from "@/components/app/AppLayout";

export default function RecreationLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout mainClassName="bg-ds-bg">{children}</AppLayout>;
}
