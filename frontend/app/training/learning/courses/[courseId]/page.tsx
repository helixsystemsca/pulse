import type { Metadata } from "next";
import { CourseDetailView } from "@/components/training/courses/CourseDetailView";

export const metadata: Metadata = {
  title: "Course | Learning | Training | Helix",
};

type Props = { params: Promise<{ courseId: string }> };

export default async function TrainingCoursePage({ params }: Props) {
  const { courseId } = await params;
  return <CourseDetailView courseId={courseId} />;
}
