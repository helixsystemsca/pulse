"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { TRAINING_ROUTES, trainingLessonHref } from "@/lib/training/routes";
import {
  fetchTrainingCourse,
  type TrainingCourseDetail,
  type TrainingLesson,
} from "@/lib/training/trainingPlatformApi";
import { cn } from "@/lib/cn";
import { uiCalloutWarning, uiPageTitle } from "@/styles/ui-classes";

type Props = { courseId: string };

export function CourseDetailView({ courseId }: Props) {
  const [course, setCourse] = useState<TrainingCourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const row = await fetchTrainingCourse(courseId);
        if (!cancelled) setCourse(row);
      } catch (e) {
        if (!cancelled) setError(parseClientApiError(e).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ds-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading course…
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="space-y-3">
        <div className={uiCalloutWarning}>{error ?? "Course not found"}</div>
        <Link href={TRAINING_ROUTES.learningCourses} className="text-sm font-semibold text-teal-700 hover:underline">
          ← Back to courses
        </Link>
      </div>
    );
  }

  const lessons: TrainingLesson[] = course.sections.flatMap((s) => s.lessons);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={TRAINING_ROUTES.learningCourses}
          className="inline-flex items-center gap-1 text-sm font-medium text-ds-muted hover:text-ds-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Courses
        </Link>
        <h2 className={cn(uiPageTitle, "mt-2")}>{course.title}</h2>
        {course.description ? <p className="mt-1 max-w-2xl text-sm text-ds-muted">{course.description}</p> : null}
      </div>

      {course.sections.map((section) => (
        <section key={section.id} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ds-muted">{section.title}</h3>
          <ul className="divide-y divide-ds-border rounded-xl border border-ds-border bg-ds-card">
            {section.lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link
                  href={trainingLessonHref(course.id, lesson.id)}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-ds-muted/20"
                >
                  <span className="font-medium text-ds-foreground">{lesson.title}</span>
                  {lesson.estimated_minutes != null ? (
                    <span className="shrink-0 text-xs text-ds-muted">{lesson.estimated_minutes} min</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {lessons.length === 0 ? (
        <p className="text-sm text-ds-muted">This course has no lessons yet.</p>
      ) : null}
    </div>
  );
}
