import type { Metadata } from "next";
import { FlashcardCoursePicker } from "@/components/training/flashcards/FlashcardCoursePicker";

export const metadata: Metadata = {
  title: "Flashcards | Training | Helix",
  description: "Study CAPM and certification flashcards with spaced repetition.",
};

export default function TrainingFlashcardsPage() {
  return <FlashcardCoursePicker />;
}
