import { AppLayout } from "@/components/app/AppLayout";

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout mainClassName="bg-ds-bg">{children}</AppLayout>;
}
