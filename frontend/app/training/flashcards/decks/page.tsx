import type { Metadata } from "next";
import { FlashcardDeckManagement } from "@/components/training/flashcards/FlashcardDeckManagement";

export const metadata: Metadata = {
  title: "Deck management | Flashcards | Training | Helix",
};

export default function TrainingFlashcardDecksPage() {
  return <FlashcardDeckManagement />;
}
