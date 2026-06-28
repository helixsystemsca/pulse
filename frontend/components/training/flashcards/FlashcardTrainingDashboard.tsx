"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Flame,
  Loader2,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import {
  computeCourseFlashcardStats,
  isSectionComplete,
  type CourseFlashcardStats,
} from "@/lib/training/flashcard-course-stats";
import type { SectionFlashcardStats } from "@/lib/training/flashcard-sections";
import { flashcardCertificationLabel } from "@/lib/training/training-milestone";
import { useFlashcardStudySettings } from "@/lib/training/flashcard-study-settings";
import { TRAINING_ROUTES, trainingFlashcardSectionStudyHref, trainingFlashcardStatisticsHref } from "@/lib/training/routes";
import {
  fetchCourseFlashcards,
  fetchTrainingCourse,
} from "@/lib/training/trainingPlatformApi";
import { cn } from "@/lib/cn";
import { uiCalloutWarning, uiPageDescription, uiPageStack, uiPageTitle } from "@/styles/ui-classes";
import { FlashcardStudySettingsPanel } from "@/components/training/flashcards/FlashcardStudySettingsPanel";
import "@/components/training/flashcards/flashcard-study.css";

type Props = { courseId: string };

function DashboardKpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
}) {
  return (
    <div className="flashcard-dashboard-kpi">
      <Icon className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden />
      <p className="flashcard-stat-value tabular-nums">{value}</p>
      <p className="flashcard-stat-label">{label}</p>
    </div>
  );
}

function SectionRow({
  courseId,
  row,
}: {
  courseId: string;
  row: SectionFlashcardStats;
}) {
  const complete = isSectionComplete(row);
  const href = trainingFlashcardSectionStudyHref(courseId, row.section.id);

  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flashcard-section-row group block rounded-xl border border-ds-border bg-ds-card p-5 shadow-sm transition",
          "hover:border-teal-500/40 hover:bg-teal-50/30 dark:hover:bg-teal-950/20",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0" aria-hidden>
            {complete ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-ds-border" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-ds-foreground group-hover:text-teal-800 dark:group-hover:text-teal-300">
                  {row.section.title}
                </h3>
                {row.section.description ? (
                  <p className="mt-1 text-sm text-ds-muted">{row.section.description}</p>
                ) : null}
              </div>
              <ChevronRight
                className="h-5 w-5 shrink-0 text-ds-muted transition group-hover:translate-x-0.5 group-hover:text-teal-600"
                aria-hidden
              />
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ds-muted">
              <span>
                <span className="font-semibold text-ds-foreground">{row.cardCount}</span>{" "}
                {row.cardCount === 1 ? "card" : "cards"}
              </span>
              <span>
                <span className="font-semibold text-ds-foreground">
                  {row.reviewedCount} of {row.cardCount}
                </span>{" "}
                learned
              </span>
              {complete ? (
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Complete</span>
              ) : row.reviewedCount > 0 ? (
                <span>In progress</span>
              ) : (
                <span>Not started</span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-ds-muted">
                <span>Section progress</span>
                <span className="tabular-nums font-medium">{row.progressPct}%</span>
              </div>
              <div
                className="flashcard-progress-track"
                role="progressbar"
                aria-valuenow={row.progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${row.section.title} progress`}
              >
                <div
                  className={cn(
                    "flashcard-progress-fill",
                    complete && "flashcard-progress-fill--complete",
                  )}
                  style={{ width: `${row.progressPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

export function FlashcardTrainingDashboard({ courseId }: Props) {
  const { settings, setSettings } = useFlashcardStudySettings();
  const [courseTitle, setCourseTitle] = useState("");
  const [courseSlug, setCourseSlug] = useState("");
  const [courseDescription, setCourseDescription] = useState<string | null>(null);
  const [stats, setStats] = useState<CourseFlashcardStats | null>(null);
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
        setStats(computeCourseFlashcardStats(course, deck.cards));
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
              Training dashboard
            </p>
            <Link
              href={trainingFlashcardStatisticsHref(courseId)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ds-border px-3 py-1.5 text-xs font-semibold text-ds-foreground transition hover:border-teal-500/40 hover:bg-teal-50/40 dark:hover:bg-teal-950/20"
            >
              <BarChart3 className="h-3.5 w-3.5" aria-hidden />
              Statistics
            </Link>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700/80 dark:text-teal-400/80">
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
              Track your progress and study flashcards section by section.
            </p>
          )}
        </div>
      </header>

      {loading && !stats ? (
        <div className="flex items-center gap-2 text-sm text-ds-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading dashboard…
        </div>
      ) : null}

      {error ? <div className={uiCalloutWarning}>{error}</div> : null}

      {stats ? (
        <>
          <section aria-label="Course progress summary" className="space-y-3">
            <div className="flashcard-dashboard-kpis">
              <DashboardKpi
                label="Overall progress"
                value={`${stats.overallProgressPct}%`}
                icon={Target}
              />
              <DashboardKpi label="Cards learned" value={stats.cardsLearned} icon={BookOpen} />
              <DashboardKpi label="Cards due today" value={stats.cardsDueToday} icon={CalendarClock} />
              <DashboardKpi label="Cards mastered" value={stats.cardsMastered} icon={Trophy} />
              <DashboardKpi label="Current streak" value={stats.studyStreakDays} icon={Flame} />
            </div>

            <div className="rounded-xl border border-ds-border bg-ds-card p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-ds-foreground">Overall completion</span>
                <span className="tabular-nums font-semibold text-ds-foreground">
                  {stats.cardsLearned} / {stats.totalCards} cards
                </span>
              </div>
              <div
                className="flashcard-progress-track h-2.5"
                role="progressbar"
                aria-valuenow={stats.overallProgressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Overall course progress"
              >
                <div
                  className="flashcard-progress-fill"
                  style={{ width: `${stats.overallProgressPct}%` }}
                />
              </div>
            </div>
          </section>

          <FlashcardStudySettingsPanel settings={settings} onChange={setSettings} />

          <section aria-label="Sections" className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ds-muted">Sections</h3>

            {stats.sections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ds-border bg-ds-muted/10 p-8 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-ds-muted" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-ds-foreground">No flashcard sections yet</p>
                <p className={cn(uiPageDescription, "mx-auto mt-1 max-w-md")}>
                  This course has no sections with flashcards. Ask your administrator to import a deck
                  pack.
                </p>
              </div>
            ) : (
              <ul className="grid gap-3">
                {stats.sections.map((row) => (
                  <SectionRow key={row.section.id} courseId={courseId} row={row} />
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
