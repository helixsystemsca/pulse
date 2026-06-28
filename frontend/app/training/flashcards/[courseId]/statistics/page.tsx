import type { Metadata } from "next";
import { FlashcardStatisticsPage } from "@/components/training/flashcards/FlashcardStatisticsPage";

export const metadata: Metadata = {
  title: "Statistics | Flashcards | Training | Helix",
};

type Props = { params: Promise<{ courseId: string }> };

export default async function TrainingFlashcardStatisticsRoute({ params }: Props) {
  const { courseId } = await params;
  return <FlashcardStatisticsPage courseId={courseId} />;
}
