import { redirect } from "next/navigation";
import { TRAINING_ROUTES } from "@/lib/training/routes";

export default function TrainingInterviewsPage() {
  redirect(TRAINING_ROUTES.flashcards);
}
