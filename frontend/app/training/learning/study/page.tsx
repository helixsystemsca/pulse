import type { Metadata } from "next";
import { TrainingLearningShell } from "@/components/training/domain/TrainingLearningShell";

export const metadata: Metadata = {
  title: "Study | Learning | Training | Helix",
};

export default function TrainingLearningStudyPage() {
  return <TrainingLearningShell section="study" />;
}
