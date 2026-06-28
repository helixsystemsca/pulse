/**
 * Training platform API — courses, lessons, study (SM-2), learning paths.
 */
import { apiFetch } from "@/lib/api";

export type TrainingCourseKind =
  | "certification"
  | "onboarding"
  | "compliance"
  | "procedure"
  | "internal"
  | "safety";

export type TrainingProgressStatus = "not_started" | "in_progress" | "completed";

export type TrainingReviewRating = "again" | "unsure" | "good" | "easy";

export type TrainingCourseSummary = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  course_kind: TrainingCourseKind;
  status: "draft" | "published" | "archived";
  completion_threshold_pct: number;
  estimated_hours: number | null;
  tags: string[];
  procedure_id: string | null;
  published_at: string | null;
  progress_pct: number | null;
  progress_status: TrainingProgressStatus | null;
};

export type TrainingLesson = {
  id: string;
  company_id: string;
  course_id: string;
  section_id: string;
  procedure_id: string | null;
  slug: string;
  title: string;
  summary: string | null;
  content_markdown: string | null;
  estimated_minutes: number | null;
  sort_order: number;
  tags: string[];
  metadata: Record<string, unknown>;
};

export type TrainingSection = {
  id: string;
  company_id: string;
  course_id: string;
  parent_section_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  sort_order: number;
  lessons: TrainingLesson[];
};

export type TrainingCourseDetail = {
  id: string;
  company_id: string;
  certification_id: string | null;
  procedure_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  course_kind: TrainingCourseKind;
  status: "draft" | "published" | "archived";
  completion_threshold_pct: number;
  estimated_hours: number | null;
  tags: string[];
  metadata: Record<string, unknown>;
  published_at: string | null;
  sections: TrainingSection[];
};

export type TrainingFlashcard = {
  id: string;
  company_id: string;
  course_id: string | null;
  lesson_id: string | null;
  card_type: string;
  prompt: string;
  answer: string;
  explanation: string | null;
  difficulty: number;
  tags: string[];
  sort_order: number;
};

export type TrainingStudyDueCard = {
  flashcard: TrainingFlashcard;
  review: {
    id: string;
    flashcard_id: string;
    ease_factor: number;
    interval_days: number;
    repetitions: number;
    next_review_at: string | null;
  } | null;
};

export type TrainingLearningPathItem = {
  id: string;
  learning_path_id: string;
  course_id: string | null;
  lesson_id: string | null;
  quiz_id: string | null;
  sort_order: number;
  is_required: boolean;
};

export type TrainingLearningPath = {
  id: string;
  company_id: string;
  certification_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  is_published: boolean;
  items: TrainingLearningPathItem[];
};

export type TrainingUserProgress = {
  id: string;
  user_id: string;
  scope_kind: "course" | "lesson" | "learning_path";
  scope_id: string;
  status: TrainingProgressStatus;
  progress_pct: number;
  last_accessed_at: string | null;
};

export type TrainingDashboard = {
  courses_in_progress: TrainingUserProgress[];
  training_due: TrainingUserProgress[];
  study_streak_days: number;
  knowledge_score: number | null;
  weak_topics: string[];
};

export async function fetchTrainingCourses(): Promise<TrainingCourseSummary[]> {
  return apiFetch<TrainingCourseSummary[]>("/api/v1/training/courses");
}

export async function fetchTrainingCourse(courseId: string): Promise<TrainingCourseDetail> {
  return apiFetch<TrainingCourseDetail>(`/api/v1/training/courses/${encodeURIComponent(courseId)}`);
}

export async function fetchTrainingLesson(courseId: string, lessonId: string): Promise<TrainingLesson> {
  return apiFetch<TrainingLesson>(
    `/api/v1/training/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`,
  );
}

export async function postTrainingProgress(body: {
  scope_kind: "course" | "lesson" | "learning_path";
  scope_id: string;
  status: TrainingProgressStatus;
  progress_pct: number;
}): Promise<TrainingUserProgress> {
  return apiFetch<TrainingUserProgress>("/api/v1/training/progress", { method: "POST", json: body });
}

export async function fetchCourseFlashcards(courseId: string): Promise<{
  course_id: string;
  course_title: string;
  cards: TrainingStudyDueCard[];
  total: number;
}> {
  return apiFetch(`/api/v1/training/courses/${encodeURIComponent(courseId)}/flashcards`);
}

export async function fetchStudyDue(limit = 30): Promise<{ cards: TrainingStudyDueCard[]; due_count: number }> {
  return apiFetch(`/api/v1/training/study/due?limit=${limit}`);
}

export async function postFlashcardReview(
  flashcardId: string,
  rating: TrainingReviewRating,
): Promise<{ next_review_at: string; interval_days: number }> {
  return apiFetch(`/api/v1/training/study/review/${encodeURIComponent(flashcardId)}`, {
    method: "POST",
    json: { rating },
  });
}

export async function fetchLearningPaths(): Promise<TrainingLearningPath[]> {
  return apiFetch<TrainingLearningPath[]>("/api/v1/training/learning-paths");
}

export async function fetchTrainingDashboard(): Promise<TrainingDashboard> {
  return apiFetch<TrainingDashboard>("/api/v1/training/dashboard");
}
