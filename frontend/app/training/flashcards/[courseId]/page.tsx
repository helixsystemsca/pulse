import type { Metadata } from "next";
import { FlashcardTrainingDashboard } from "@/components/training/flashcards/FlashcardTrainingDashboard";

export const metadata: Metadata = {
  title: "Dashboard | Flashcards | Training | Helix",
};

type Props = { params: Promise<{ courseId: string }> };

export default async function TrainingFlashcardCoursePage({ params }: Props) {
  const { courseId } = await params;
  return <FlashcardTrainingDashboard courseId={courseId} />;
}
