import type { Metadata } from "next";
import { LessonPlayer } from "@/components/training/courses/LessonPlayer";

export const metadata: Metadata = {
  title: "Lesson | Learning | Training | Helix",
};

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function TrainingLessonPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  return <LessonPlayer courseId={courseId} lessonId={lessonId} />;
}
