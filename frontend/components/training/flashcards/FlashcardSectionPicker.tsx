"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Loader2, Play } from "lucide-react";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import {
  computeSectionFlashcardStats,
  type SectionFlashcardStats,
} from "@/lib/training/flashcard-sections";
import { flashcardCertificationLabel } from "@/lib/training/training-milestone";
import { useFlashcardStudySettings } from "@/lib/training/flashcard-study-settings";
import { TRAINING_ROUTES, trainingFlashcardSectionStudyHref } from "@/lib/training/routes";
import {
  fetchCourseFlashcards,
  fetchTrainingCourse,
} from "@/lib/training/trainingPlatformApi";
import { cn } from "@/lib/cn";
import { uiCalloutWarning, uiPageDescription, uiPageStack, uiPageTitle } from "@/styles/ui-classes";
import { FlashcardStudySettingsPanel } from "@/components/training/flashcards/FlashcardStudySettingsPanel";
import "@/components/training/flashcards/flashcard-study.css";

type Props = { courseId: string };

function progressStatusLabel(stats: SectionFlashcardStats): string {
  if (stats.progressPct >= 100) return "Complete";
  if (stats.reviewedCount > 0) return "In progress";
  return "Not started";
}

export function FlashcardSectionPicker({ courseId }: Props) {
  const { settings, setSettings } = useFlashcardStudySettings();
  const [courseTitle, setCourseTitle] = useState("");
  const [courseSlug, setCourseSlug] = useState("");
  const [courseDescription, setCourseDescription] = useState<string | null>(null);
  const [sections, setSections] = useState<SectionFlashcardStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [deck, course] = await Promise.all([
          fetchCourseFlashcards(courseId),
          fetchTrainingCourse(courseId),
        ]);
        if (cancelled) return;
        setCourseTitle(course.title);
        setCourseSlug(course.slug);
        setCourseDescription(course.description);
        setSections(computeSectionFlashcardStats(course, deck.cards));
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

  return (
    <div className={uiPageStack}>
      <header className="space-y-3">
        <Link
          href={TRAINING_ROUTES.flashcards}
          className="inline-flex items-center gap-1 text-sm font-medium text-ds-muted hover:text-ds-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Courses
        </Link>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
            {flashcardCertificationLabel({
              slug: courseSlug,
              title: courseTitle,
              course_kind: "certification",
            })}
          </p>
          <h2 className={uiPageTitle}>{courseTitle || "Course"}</h2>
          {courseDescription ? (
            <p className={cn(uiPageDescription, "max-w-2xl")}>{courseDescription}</p>
          ) : (
            <p className={cn(uiPageDescription, "max-w-2xl")}>
              Choose a section to study flashcards. Progress is tracked per section.
            </p>
          )}
        </div>
      </header>

      <FlashcardStudySettingsPanel settings={settings} onChange={setSettings} />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-ds-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading sections…
        </div>
      ) : null}

      {error ? <div className={uiCalloutWarning}>{error}</div> : null}

      {!loading && !error && sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ds-border bg-ds-muted/10 p-8 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-ds-muted" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-ds-foreground">No flashcard sections yet</p>
          <p className={cn(uiPageDescription, "mx-auto mt-1 max-w-md")}>
            This course has no sections with flashcards. Ask your administrator to import a deck pack.
          </p>
        </div>
      ) : null}

      {!loading && sections.length > 0 ? (
        <ul className="grid gap-4">
          {sections.map((row) => (
            <li
              key={row.section.id}
              className="rounded-xl border border-ds-border bg-ds-card p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <h3 className="text-base font-semibold text-ds-foreground">{row.section.title}</h3>
                    {row.section.description ? (
                      <p className="mt-1 text-sm text-ds-muted">{row.section.description}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ds-muted">
                    <span>
                      <span className="font-semibold text-ds-foreground">{row.cardCount}</span>{" "}
                      {row.cardCount === 1 ? "card" : "cards"}
                    </span>
                    <span>
                      Progress:{" "}
                      <span className="font-semibold text-ds-foreground">
                        {row.reviewedCount} of {row.cardCount} reviewed
                      </span>
                    </span>
                    <span>{progressStatusLabel(row)}</span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-ds-muted">
                      <span>Completion</span>
                      <span className="tabular-nums font-medium">{row.progressPct}%</span>
                    </div>
                    <div
                      className="flashcard-progress-track"
                      role="progressbar"
                      aria-valuenow={row.progressPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${row.section.title} completion`}
                    >
                      <div
                        className="flashcard-progress-fill"
                        style={{ width: `${row.progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <Link
                  href={trainingFlashcardSectionStudyHref(courseId, row.section.id)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
                >
                  <Play className="h-4 w-4" aria-hidden />
                  Study
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
