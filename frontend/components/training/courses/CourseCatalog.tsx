"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, ChevronRight, Loader2 } from "lucide-react";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { trainingCourseHref } from "@/lib/training/routes";
import {
  fetchTrainingCourses,
  type TrainingCourseSummary,
} from "@/lib/training/trainingPlatformApi";
import { cn } from "@/lib/cn";
import { uiCalloutWarning, uiPageDescription } from "@/styles/ui-classes";

function progressLabel(course: TrainingCourseSummary): string {
  if (course.progress_status === "completed") return "Complete";
  if (course.progress_pct != null && course.progress_pct > 0) return `${course.progress_pct}%`;
  return "Not started";
}

export function CourseCatalog() {
  const [courses, setCourses] = useState<TrainingCourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchTrainingCourses();
        if (!cancelled) setCourses(rows);
      } catch (e) {
        if (!cancelled) setError(parseClientApiError(e).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ds-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading courses…
      </div>
    );
  }

  if (error) {
    return <div className={uiCalloutWarning}>{error}</div>;
  }

  if (courses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ds-border bg-ds-muted/10 p-8 text-center">
        <BookOpen className="mx-auto h-8 w-8 text-ds-muted" aria-hidden />
        <p className="mt-3 text-sm font-medium text-ds-foreground">No published courses yet</p>
        <p className={cn(uiPageDescription, "mx-auto mt-1 max-w-md")}>
          Managers can import course packs from Training settings, or publish courses when authoring is enabled.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {courses.map((course) => (
        <li key={course.id}>
          <Link
            href={trainingCourseHref(course.id)}
            className="group flex h-full flex-col rounded-xl border border-ds-border bg-ds-card p-4 shadow-sm transition hover:border-teal-500/40 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                  {course.course_kind}
                </p>
                <h3 className="mt-1 text-base font-semibold text-ds-foreground group-hover:text-teal-700 dark:group-hover:text-teal-300">
                  {course.title}
                </h3>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-ds-muted group-hover:text-teal-600" aria-hidden />
            </div>
            {course.description ? (
              <p className="mt-2 line-clamp-2 flex-1 text-sm text-ds-muted">{course.description}</p>
            ) : null}
            <div className="mt-4 flex items-center justify-between text-xs text-ds-muted">
              <span>{progressLabel(course)}</span>
              {course.estimated_hours != null ? <span>{course.estimated_hours}h est.</span> : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
