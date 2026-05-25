import type { Metadata } from "next";
import { TrainingLearningShell } from "@/components/training/domain/TrainingLearningShell";

export const metadata: Metadata = {
  title: "Learning | Training | Panorama",
  description: "Procedure assignments, acknowledgements, and completion workflows.",
};

type Props = { params: Promise<{ section: string }> };

export default async function TrainingLearningSectionPage({ params }: Props) {
  const { section } = await params;
  return <TrainingLearningShell section={section} />;
}
