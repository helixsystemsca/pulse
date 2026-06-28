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
    last_rating: TrainingReviewRating | null;
    next_review_at: string | null;
    last_reviewed_at: string | null;
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

export type TrainingStudyStatisticsSection = {
  section_id: string;
  section_title: string;
  accuracy_pct: number;
  reviews_count: number;
  miss_count: number;
};

export type TrainingStudyStatisticsMissedCard = {
  flashcard_id: string;
  prompt: string;
  miss_count: number;
  section_id: string | null;
  section_title: string | null;
};

export type TrainingStudyStatistics = {
  course_id: string;
  course_title: string;
  cards_reviewed_today: number;
  cards_reviewed_week: number;
  cards_reviewed_month: number;
  current_streak_days: number;
  longest_streak_days: number;
  accuracy_pct: number | null;
  cards_mastered: number;
  cards_due: number;
  weakest_sections: TrainingStudyStatisticsSection[];
  most_missed_cards: TrainingStudyStatisticsMissedCard[];
};

export async function fetchCourseStudyStatistics(courseId: string): Promise<TrainingStudyStatistics> {
  return apiFetch(
    `/api/v1/training/courses/${encodeURIComponent(courseId)}/study-statistics`,
  );
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

export type TrainingDeckSummary = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  course_kind: TrainingCourseKind;
  status: "draft" | "published" | "archived";
  certification_id: string | null;
  certification_slug: string | null;
  certification_title: string | null;
  deck_version: string;
  updated_at: string | null;
  card_count: number;
  section_count: number;
  tags: string[];
};

export type TrainingImportResult = {
  batch_id: string | null;
  source_name: string;
  status: "completed" | "failed_validation";
  stats: Record<string, number>;
  created: Record<string, number>;
  updated: Record<string, number>;
  skipped: Record<string, number>;
  errors: { severity: string; code: string; path: string; message: string }[];
  warnings: { severity: string; code: string; path: string; message: string }[];
};

export async function fetchTrainingDecks(includeArchived = true): Promise<TrainingDeckSummary[]> {
  const q = includeArchived ? "?include_archived=true" : "?include_archived=false";
  return apiFetch<TrainingDeckSummary[]>(`/api/v1/training/decks${q}`);
}

export async function importTrainingDeckPack(rawJson: string): Promise<TrainingImportResult> {
  return apiFetch<TrainingImportResult>("/api/v1/training/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawJson,
  });
}

export async function exportTrainingDeck(courseId: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(
    `/api/v1/training/decks/${encodeURIComponent(courseId)}/export`,
  );
}

export async function duplicateTrainingDeck(
  courseId: string,
  body: { new_slug?: string; new_title?: string },
): Promise<TrainingDeckSummary> {
  return apiFetch<TrainingDeckSummary>(
    `/api/v1/training/decks/${encodeURIComponent(courseId)}/duplicate`,
    { method: "POST", json: body },
  );
}

export async function archiveTrainingDeck(courseId: string): Promise<TrainingDeckSummary> {
  return apiFetch<TrainingDeckSummary>(
    `/api/v1/training/decks/${encodeURIComponent(courseId)}/archive`,
    { method: "POST" },
  );
}

export type TrainingDeckValidationReport = {
  source_name: string | null;
  version: string | null;
  status: "valid" | "invalid";
  errors: { severity: string; code: string; path: string; message: string }[];
  warnings: { severity: string; code: string; path: string; message: string }[];
  statistics: {
    courses: number;
    sections: number;
    flashcards: number;
    flashcards_with_explanation: number;
    flashcards_with_tags: number;
    flashcards_missing_explanation: number;
    flashcards_missing_tags: number;
    sections_without_cards: number;
    invalid_difficulty_count: number;
    duplicate_questions: number;
    duplicate_answers: number;
    by_difficulty: Record<string, number>;
  };
};

export async function validateTrainingDeck(rawJson: string): Promise<TrainingDeckValidationReport> {
  return apiFetch<TrainingDeckValidationReport>("/api/v1/training/decks/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawJson,
  });
}

export async function renameTrainingDeck(
  courseId: string,
  body: { title: string; description?: string | null },
): Promise<TrainingDeckSummary> {
  return apiFetch<TrainingDeckSummary>(
    `/api/v1/training/decks/${encodeURIComponent(courseId)}`,
    { method: "PATCH", json: body },
  );
}
