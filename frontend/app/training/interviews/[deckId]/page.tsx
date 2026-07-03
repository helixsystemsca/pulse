import { InterviewStudyApp } from "@/components/training/interviews/InterviewStudyApp";

type Props = { params: Promise<{ deckId: string }> };

export default async function TrainingInterviewDeckPage({ params }: Props) {
  const { deckId } = await params;
  return <InterviewStudyApp deckId={deckId} />;
}
