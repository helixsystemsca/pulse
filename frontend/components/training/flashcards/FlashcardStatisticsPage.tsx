"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  Loader2,
  Target,
  TrendingDown,
  Trophy,
} from "lucide-react";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import {
  averageSessionLengthSeconds,
  formatSessionDuration,
} from "@/lib/training/flashcard-study-sessions";
import { flashcardCertificationLabel } from "@/lib/training/training-milestone";
import {
  trainingFlashcardCourseHref,
  trainingFlashcardSectionStudyHref,
  TRAINING_ROUTES,
} from "@/lib/training/routes";
import {
  fetchCourseStudyStatistics,
  fetchTrainingCourse,
  type TrainingStudyStatistics,
} from "@/lib/training/trainingPlatformApi";
import { cn } from "@/lib/cn";
import { uiCalloutWarning, uiPageDescription, uiPageStack, uiPageTitle } from "@/styles/ui-classes";
import "@/components/training/flashcards/flashcard-study.css";

type Props = { courseId: string };

function StatTile({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
}) {
  return (
    <div className="flashcard-dashboard-kpi">
      <p className="flashcard-stat-value tabular-nums">{value}</p>
      <p className="flashcard-stat-label">{label}</p>
      {sublabel ? <p className="mt-0.5 text-[10px] text-ds-muted">{sublabel}</p> : null}
    </div>
  );
}

export function FlashcardStatisticsPage({ courseId }: Props) {
  const [courseTitle, setCourseTitle] = useState("");
  const [courseSlug, setCourseSlug] = useState("");
  const [stats, setStats] = useState<TrainingStudyStatistics | null>(null);
  const [avgSessionSeconds, setAvgSessionSeconds] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [course, data] = await Promise.all([
          fetchTrainingCourse(courseId),
          fetchCourseStudyStatistics(courseId),
        ]);
        if (cancelled) return;
        setCourseTitle(course.title);
        setCourseSlug(course.slug);
        setStats(data);
        setAvgSessionSeconds(averageSessionLengthSeconds(courseId));
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

  const accuracyLabel =
    stats?.accuracy_pct == null ? "—" : `${stats.accuracy_pct}%`;

  return (
    <div className={uiPageStack}>
      <header className="space-y-3">
        <Link
          href={trainingFlashcardCourseHref(courseId)}
          className="inline-flex items-center gap-1 text-sm font-medium text-ds-muted hover:text-ds-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Dashboard
        </Link>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
            Statistics
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700/80 dark:text-teal-400/80">
            {flashcardCertificationLabel({
              slug: courseSlug,
              title: courseTitle,
              course_kind: "certification",
            })}
          </p>
          <h2 className={uiPageTitle}>{courseTitle || "Course"}</h2>
          <p className={cn(uiPageDescription, "max-w-2xl")}>
            Review activity, accuracy, streaks, and areas to focus on.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-ds-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading statistics…
        </div>
      ) : null}

      {error ? <div className={uiCalloutWarning}>{error}</div> : null}

      {stats && !loading ? (
        <div className="space-y-6">
          <section aria-label="Review activity" className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ds-muted">
              <Calendar className="h-4 w-4" aria-hidden />
              Cards reviewed
            </h3>
            <div className="flashcard-stats-grid-3">
              <StatTile label="Today" value={stats.cards_reviewed_today} />
              <StatTile label="This week" value={stats.cards_reviewed_week} sublabel="Last 7 days" />
              <StatTile label="This month" value={stats.cards_reviewed_month} sublabel="Last 30 days" />
            </div>
          </section>

          <section aria-label="Performance summary" className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ds-muted">
              <BarChart3 className="h-4 w-4" aria-hidden />
              Performance
            </h3>
            <div className="flashcard-dashboard-kpis">
              <StatTile label="Current streak" value={stats.current_streak_days} />
              <StatTile label="Longest streak" value={stats.longest_streak_days} />
              <StatTile label="Accuracy" value={accuracyLabel} />
              <StatTile label="Cards mastered" value={stats.cards_mastered} />
              <StatTile label="Cards due" value={stats.cards_due} />
            </div>
            <div className="flashcard-dashboard-kpis sm:grid-cols-1 lg:grid-cols-1">
              <StatTile
                label="Avg session length"
                value={formatSessionDuration(avgSessionSeconds)}
                sublabel="Based on completed study sessions on this device"
              />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-ds-border bg-ds-card p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ds-muted">
                <TrendingDown className="h-4 w-4" aria-hidden />
                Weakest sections
              </h3>
              {stats.weakest_sections.length === 0 ? (
                <p className="mt-4 text-sm text-ds-muted">
                  Study more cards to see section-level accuracy.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {stats.weakest_sections.map((section) => (
                    <li key={section.section_id}>
                      <Link
                        href={trainingFlashcardSectionStudyHref(courseId, section.section_id)}
                        className="block rounded-lg border border-ds-border px-4 py-3 transition hover:border-teal-500/40 hover:bg-teal-50/30 dark:hover:bg-teal-950/20"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ds-foreground">{section.section_title}</p>
                            <p className="mt-0.5 text-xs text-ds-muted">
                              {section.reviews_count} reviews · {section.miss_count} misses
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                            {section.accuracy_pct}%
                          </span>
                        </div>
                        <div className="flashcard-progress-track mt-2">
                          <div
                            className="flashcard-progress-fill"
                            style={{ width: `${section.accuracy_pct}%` }}
                          />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-ds-border bg-ds-card p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ds-muted">
                <Target className="h-4 w-4" aria-hidden />
                Most missed cards
              </h3>
              {stats.most_missed_cards.length === 0 ? (
                <p className="mt-4 text-sm text-ds-muted">No missed ratings recorded yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {stats.most_missed_cards.map((card) => (
                    <li
                      key={card.flashcard_id}
                      className="rounded-lg border border-ds-border px-4 py-3"
                    >
                      <p className="line-clamp-2 text-sm font-medium text-ds-foreground">{card.prompt}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ds-muted">
                        {card.section_title ? <span>{card.section_title}</span> : null}
                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                          {card.miss_count} {card.miss_count === 1 ? "miss" : "misses"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={trainingFlashcardCourseHref(courseId)}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <Trophy className="h-4 w-4" aria-hidden />
              Back to dashboard
            </Link>
            <Link
              href={TRAINING_ROUTES.flashcards}
              className="inline-flex items-center gap-2 rounded-lg border border-ds-border px-4 py-2.5 text-sm font-semibold hover:bg-ds-muted/20"
            >
              All courses
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
