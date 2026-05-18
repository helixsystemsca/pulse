import type { Metadata } from "next";
import { TrainingLearningApp } from "@/components/training/TrainingLearningApp";

export const metadata: Metadata = {
  title: "Training | Standards | Panorama",
  description: "Assigned learning, onboarding, and completion progress.",
};

export default function StandardsTrainingPage() {
  return <TrainingLearningApp />;
}
