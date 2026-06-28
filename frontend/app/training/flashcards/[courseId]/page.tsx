import type { Metadata } from "next";
import { FlashcardSectionPicker } from "@/components/training/flashcards/FlashcardSectionPicker";

export const metadata: Metadata = {
  title: "Sections | Flashcards | Training | Helix",
};

type Props = { params: Promise<{ courseId: string }> };

export default async function TrainingFlashcardCoursePage({ params }: Props) {
  const { courseId } = await params;
  return <FlashcardSectionPicker courseId={courseId} />;
}
