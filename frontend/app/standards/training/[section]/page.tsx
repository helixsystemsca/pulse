import type { Metadata } from "next";
import { WorkforceTrainingShell } from "@/components/standards/workforce-training/WorkforceTrainingShell";

export const metadata: Metadata = {
  title: "Workforce qualifications | Standards | Panorama",
  description: "Workforce compliance, certifications, and qualification readiness.",
};

type Props = { params: Promise<{ section: string }> };

export default async function StandardsTrainingSectionPage({ params }: Props) {
  const { section } = await params;
  return <WorkforceTrainingShell section={section} />;
}
