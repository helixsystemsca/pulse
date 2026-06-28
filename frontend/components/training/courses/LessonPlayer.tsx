"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { trainingCourseHref } from "@/lib/training/routes";
import {
  fetchTrainingLesson,
  postTrainingProgress,
  type TrainingLesson,
} from "@/lib/training/trainingPlatformApi";
import { cn } from "@/lib/cn";
import { uiCalloutWarning, uiPageTitle } from "@/styles/ui-classes";

type Props = { courseId: string; lessonId: string };

export function LessonPlayer({ courseId, lessonId }: Props) {
  const [lesson, setLesson] = useState<TrainingLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const row = await fetchTrainingLesson(courseId, lessonId);
        if (!cancelled) {
          setLesson(row);
          await postTrainingProgress({
            scope_kind: "lesson",
            scope_id: lessonId,
            status: "in_progress",
            progress_pct: 10,
          });
        }
      } catch (e) {
        if (!cancelled) setError(parseClientApiError(e).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId]);

  const markComplete = useCallback(async () => {
    setCompleting(true);
    setError(null);
    try {
      await postTrainingProgress({
        scope_kind: "lesson",
        scope_id: lessonId,
        status: "completed",
        progress_pct: 100,
      });
      setCompleted(true);
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setCompleting(false);
    }
  }, [lessonId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ds-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading lesson…
      </div>
    );
  }

  if (error && !lesson) {
    return (
      <div className="space-y-3">
        <div className={uiCalloutWarning}>{error}</div>
        <Link href={trainingCourseHref(courseId)} className="text-sm font-semibold text-teal-700 hover:underline">
          ← Back to course
        </Link>
      </div>
    );
  }

  if (!lesson) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={trainingCourseHref(courseId)}
          className="inline-flex items-center gap-1 text-sm font-medium text-ds-muted hover:text-ds-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to course
        </Link>
        <h2 className={cn(uiPageTitle, "mt-2")}>{lesson.title}</h2>
        {lesson.summary ? <p className="mt-1 text-sm text-ds-muted">{lesson.summary}</p> : null}
      </div>

      <article className="prose prose-sm max-w-none rounded-xl border border-ds-border bg-ds-card p-6 dark:prose-invert">
        {lesson.content_markdown ? (
          <div className="whitespace-pre-wrap text-ds-foreground">{lesson.content_markdown}</div>
        ) : (
          <p className="text-ds-muted">No lesson content yet.</p>
        )}
      </article>

      {error ? <div className={uiCalloutWarning}>{error}</div> : null}

      <div className="flex flex-wrap items-center gap-3">
        {completed ? (
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            Lesson completed
          </p>
        ) : (
          <button
            type="button"
            onClick={() => void markComplete()}
            disabled={completing}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {completing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Mark complete
          </button>
        )}
      </div>
    </div>
  );
}
