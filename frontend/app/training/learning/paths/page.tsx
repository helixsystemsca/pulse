import type { Metadata } from "next";
import { TrainingLearningShell } from "@/components/training/domain/TrainingLearningShell";

export const metadata: Metadata = {
  title: "Paths | Learning | Training | Helix",
};

export default function TrainingLearningPathsPage() {
  return <TrainingLearningShell section="paths" />;
}
