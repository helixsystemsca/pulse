"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, ChevronRight, GraduationCap, Loader2, Settings2 } from "lucide-react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import {
  flashcardCertificationLabel,
  isFlashcardStudyCourse,
} from "@/lib/training/training-milestone";
import { TRAINING_ROUTES, trainingFlashcardStudyHref } from "@/lib/training/routes";
import { fetchTrainingCourses, type TrainingCourseSummary } from "@/lib/training/trainingPlatformApi";
import { cn } from "@/lib/cn";
import { uiCalloutWarning, uiPageDescription, uiPageStack, uiPageTitle } from "@/styles/ui-classes";

export function FlashcardCoursePicker() {
  const { session } = usePulseAuth();
  const canManageDecks = sessionHasAnyRole(session, "manager", "company_admin", "system_admin");
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
        if (!cancelled) {
          setCourses(rows.filter(isFlashcardStudyCourse));
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
  }, []);

  return (
    <div className={uiPageStack}>
      <header className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={uiPageTitle}>Flashcards</h2>
            <p className={cn(uiPageDescription, "max-w-2xl")}>
              Select a certification deck to study with spaced repetition. CAPM, FMP, Six Sigma, Power BI, and other
              published packs appear here.
            </p>
          </div>
          {canManageDecks ? (
            <Link
              href={TRAINING_ROUTES.flashcardDecks}
              className="inline-flex items-center gap-2 rounded-lg border border-ds-border px-3 py-2 text-sm font-semibold hover:bg-ds-muted/20"
            >
              <Settings2 className="h-4 w-4" aria-hidden />
              Manage decks
            </Link>
          ) : null}
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-ds-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading courses…
        </div>
      ) : null}

      {error ? <div className={uiCalloutWarning}>{error}</div> : null}

      {!loading && !error && courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ds-border bg-ds-muted/10 p-8 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-ds-muted" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-ds-foreground">No study courses available</p>
          <p className={cn(uiPageDescription, "mx-auto mt-1 max-w-md")}>
            Flashcard packs must be imported into your tenant database — JSON files in the repo are not loaded
            automatically.{" "}
            {canManageDecks ? (
              <>
                Use{" "}
                <Link href={TRAINING_ROUTES.flashcardDecks} className="font-semibold text-teal-700 hover:underline">
                  Manage decks → Import deck
                </Link>{" "}
                or run{" "}
                <code className="rounded bg-ds-muted/30 px-1 py-0.5 text-xs">
                  python -m scripts.seed_capm_training_packs
                </code>{" "}
                with your <code className="rounded bg-ds-muted/30 px-1 py-0.5 text-xs">COMPANY_ID</code>.
              </>
            ) : (
              "Ask your administrator to import the CAPM flashcard packs."
            )}
          </p>
        </div>
      ) : null}

      {!loading && courses.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <li key={course.id}>
              <Link
                href={trainingFlashcardStudyHref(course.id)}
                className="group flex h-full flex-col rounded-xl border border-ds-border bg-ds-card p-5 shadow-sm transition hover:border-teal-500/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-400">
                      <BookOpen className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                        {flashcardCertificationLabel(course)}
                      </p>
                      <h3 className="mt-0.5 text-base font-semibold text-ds-foreground group-hover:text-teal-700 dark:group-hover:text-teal-300">
                        {course.title}
                      </h3>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-ds-muted group-hover:text-teal-600" aria-hidden />
                </div>
                {course.description ? (
                  <p className="mt-3 line-clamp-2 flex-1 text-sm text-ds-muted">{course.description}</p>
                ) : null}
                <p className="mt-4 text-xs font-medium text-ds-muted">Tap to choose a section →</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
