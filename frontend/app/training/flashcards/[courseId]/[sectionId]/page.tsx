import type { Metadata } from "next";
import { CapmFlashcardStudy } from "@/components/training/flashcards/CapmFlashcardStudy";

export const metadata: Metadata = {
  title: "Study | Flashcards | Training | Helix",
};

type Props = { params: Promise<{ courseId: string; sectionId: string }> };

export default async function TrainingFlashcardSectionStudyPage({ params }: Props) {
  const { courseId, sectionId } = await params;
  return <CapmFlashcardStudy courseId={courseId} sectionId={sectionId} />;
}
