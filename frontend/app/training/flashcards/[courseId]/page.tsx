import type { Metadata } from "next";
import { CapmFlashcardStudy } from "@/components/training/flashcards/CapmFlashcardStudy";

export const metadata: Metadata = {
  title: "Study | Flashcards | Training | Helix",
};

type Props = { params: Promise<{ courseId: string }> };

export default async function TrainingFlashcardStudyPage({ params }: Props) {
  const { courseId } = await params;
  return <CapmFlashcardStudy courseId={courseId} />;
}
