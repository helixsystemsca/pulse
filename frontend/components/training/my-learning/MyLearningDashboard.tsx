"use client";

import {
  AlertTriangle,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Grid3x3,
  TrendingUp,
  Waves,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { TrainingTierBadge } from "@/components/training/TrainingTierBadge";
import type { MyLearningDashboardModel, MyLearningCategory, MyLearningItemStatus } from "@/lib/training/myLearningDashboard";
import { cn } from "@/lib/cn";
import "./my-learning-dashboard.css";

type Props = {
  displayName: string;
  jobTitle?: string | null;
  loading?: boolean;
  loadError?: string | null;
  model: MyLearningDashboardModel;
};

const STAT_GRADIENTS = [
  "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
  "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  "linear-gradient(135deg, #10b981 0%, #059669 100%)",
] as const;

function StatCard({
  label,
  value,
  description,
  trend,
  icon: Icon,
  gradient,
  delayClass,
}: {
  label: string;
  value: string | number;
  description: string;
  trend?: { text: string; positive: boolean };
  icon: LucideIcon;
  gradient: string;
  delayClass?: string;
}) {
  return (
    <div
      className={cn(
        "ml-stat-card ml-fade-in rounded-2xl border border-ds-border bg-ds-primary p-5 shadow-[0_4px_14px_rgba(15,23,42,0.06)]",
        delayClass,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">{label}</span>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-white shadow-sm"
          style={{ background: gradient }}
        >
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
      </div>
      <div className="text-3xl font-extrabold tabular-nums tracking-tight text-ds-foreground">{value}</div>
      <p className="mt-1 text-sm text-ds-muted">{description}</p>
      {trend ? (
        <p
          className={cn(
            "mt-3 inline-flex rounded-md px-2.5 py-1 text-xs font-semibold",
            trend.positive
              ? "bg-[color-mix(in_srgb,var(--ml-success)_12%,transparent)] text-[var(--ml-success)]"
              : "bg-[color-mix(in_srgb,var(--ml-danger)_10%,transparent)] text-[var(--ml-danger)]",
          )}
        >
          {trend.text}
        </p>
      ) : null}
    </div>
  );
}

function ProgressRing({ category }: { category: MyLearningCategory }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (category.percent / 100) * circumference;

  return (
    <div className="ml-progress-card ml-fade-in flex flex-col items-center rounded-2xl border border-ds-border bg-ds-primary p-6 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
      <div className="relative h-[140px] w-[140px]">
        <svg className="h-full w-full" width="140" height="140" aria-hidden>
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="var(--ds-border)"
            strokeWidth="8"
          />
          <circle
            className="ml-ring-circle"
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={category.ringColor}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-extrabold tabular-nums text-ds-foreground">{category.percent}%</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ds-muted">complete</span>
        </div>
      </div>
      <h4 className="mt-4 text-center text-sm font-bold text-ds-foreground">{category.title}</h4>
      <p className="mt-0.5 text-center text-xs text-ds-muted">
        {category.completed} of {category.total} procedures
      </p>
    </div>
  );
}

const CATEGORY_ICONS: Record<MyLearningCategory["id"], LucideIcon> = {
  arena_ops: Grid3x3,
  pool_aquatics: Waves,
  emergency: Bell,
  maintenance: Wrench,
};

function statusDotClass(status: MyLearningItemStatus): string {
  if (status === "complete") return "bg-[var(--ml-success)]";
  if (status === "partial") return "bg-[var(--ml-warning)]";
  return "bg-[var(--ml-danger)]";
}

function CategoryCard({ category }: { category: MyLearningCategory }) {
  const Icon = CATEGORY_ICONS[category.id];
  const preview = category.items.slice(0, 8);
  const more = category.items.length - preview.length;

  return (
    <div className="ml-category-card rounded-2xl border border-ds-border bg-ds-primary p-4 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
      <div className="mb-4 flex items-center gap-3 border-b border-ds-border/70 pb-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-white"
          style={{ background: category.gradient }}
        >
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-bold text-ds-foreground">{category.title}</h4>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-ds-muted">
          {category.completed}/{category.total}
        </span>
      </div>
      <ul className="space-y-2">
        {preview.map((item) => (
          <li key={item.programId} className="flex items-center gap-2.5 text-sm">
            <span
              className={cn("h-2.5 w-2.5 shrink-0 rounded-full", statusDotClass(item.status))}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate font-medium text-ds-foreground">{item.name}</span>
            <span
              className={cn(
                "shrink-0 text-[11px] font-semibold tabular-nums",
                item.status === "complete"
                  ? "text-[var(--ml-success)]"
                  : item.status === "partial"
                    ? "text-[var(--ml-warning)]"
                    : "text-[var(--ml-danger)]",
              )}
            >
              {item.status === "complete" ? (
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              ) : (
                item.progressLabel
              )}
            </span>
          </li>
        ))}
        {more > 0 ? (
          <li className="pt-1 text-xs font-medium text-ds-muted">+{more} more procedures</li>
        ) : null}
      </ul>
    </div>
  );
}

export function MyLearningDashboard({ displayName, jobTitle, loading, loadError, model }: Props) {
  const { stats, categories, checklist, incompleteChecklistCount, recentAcknowledgements } = model;

  const statsCards = [
    {
      label: "Overall progress",
      value: `${stats.overallPercent}%`,
      description: stats.overallDescription,
      trend:
        stats.overallPercent >= 50
          ? { text: "↗ Keep going", positive: true }
          : { text: "Focus on certifications", positive: false },
      icon: Clock,
      gradient: STAT_GRADIENTS[0],
    },
    {
      label: "High risk",
      value: stats.highRiskCount,
      description: stats.highRiskDescription,
      trend:
        stats.highRiskCount === 0
          ? { text: "↗ All clear", positive: true }
          : { text: "Needs attention", positive: false },
      icon: AlertTriangle,
      gradient: STAT_GRADIENTS[1],
    },
    {
      label: "Routines",
      value: stats.routinesCount,
      description: stats.routinesDescription,
      icon: TrendingUp,
      gradient: STAT_GRADIENTS[2],
    },
    {
      label: "Completed",
      value: stats.completedAckCount,
      description: stats.completedDescription,
      trend: { text: "↗ Great work", positive: true },
      icon: CheckCircle2,
      gradient: STAT_GRADIENTS[3],
    },
  ] as const;

  const checklistIncomplete = checklist.filter((c) => !c.done);
  const checklistComplete = checklist.filter((c) => c.done);

  return (
    <div className="my-learning-dash space-y-10 pb-8">
      <header className="ml-fade-in">
        <div className="flex flex-wrap items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
            style={{ background: "linear-gradient(135deg, var(--ml-primary) 0%, #4db8c4 100%)" }}
          >
            <BookOpen className="h-6 w-6" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-ds-foreground sm:text-[1.75rem]">
              My Learning
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ds-muted">
              Your personal training dashboard — progress, compliance gaps, and acknowledgements in one place.
            </p>
            <p className="mt-2 text-sm font-semibold text-ds-foreground">
              {displayName}
              {jobTitle?.trim() ? (
                <span className="font-normal text-ds-muted"> · {jobTitle.trim()}</span>
              ) : null}
            </p>
            {loading ? <p className="mt-2 text-xs text-ds-muted">Loading your training record…</p> : null}
            {loadError ? (
              <p className="mt-2 text-xs font-semibold text-ds-danger" role="alert">
                Could not load training: {loadError}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section aria-labelledby="ml-stats-heading">
        <h2 id="ml-stats-heading" className="sr-only">
          Training overview
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {statsCards.map((card, i) => (
            <StatCard key={card.label} {...card} delayClass={`ml-fade-in`} />
          ))}
        </div>
      </section>

      {categories.length > 0 ? (
        <section aria-labelledby="ml-progress-heading" className="space-y-4">
          <h2 id="ml-progress-heading" className="text-sm font-bold uppercase tracking-wide text-ds-muted">
            Progress by area
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {categories.map((cat) => (
              <ProgressRing key={cat.id} category={cat} />
            ))}
          </div>
        </section>
      ) : null}

      {checklist.length > 0 ? (
        <section aria-labelledby="ml-checklist-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="ml-checklist-heading" className="text-sm font-bold uppercase tracking-wide text-ds-muted">
              Compliance checklist
            </h2>
            {incompleteChecklistCount > 0 ? (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--ml-danger)_12%,transparent)] px-3 py-1 text-xs font-bold text-[var(--ml-danger)]">
                {incompleteChecklistCount} incomplete
              </span>
            ) : (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--ml-success)_12%,transparent)] px-3 py-1 text-xs font-bold text-[var(--ml-success)]">
                All clear
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {checklistIncomplete.map((item) => (
              <div
                key={item.programId}
                className="ml-checklist-item flex gap-3 rounded-xl border border-[color-mix(in_srgb,var(--ml-danger)_25%,var(--ds-border))] bg-ds-primary/80 px-4 py-3"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--ml-danger)_14%,transparent)] text-sm font-bold text-[var(--ml-danger)]"
                  aria-hidden
                >
                  !
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ds-foreground">{item.title}</p>
                    <TrainingTierBadge tier={item.tier} />
                  </div>
                  <p className="mt-0.5 text-xs text-ds-muted">{item.meta}</p>
                </div>
              </div>
            ))}
            {checklistComplete.map((item) => (
              <div
                key={item.programId}
                className="ml-checklist-item flex gap-3 rounded-xl border border-ds-border bg-ds-secondary/30 px-4 py-3 opacity-90"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--ml-success)_14%,transparent)] text-[var(--ml-success)]"
                  aria-hidden
                >
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ds-foreground">{item.title}</p>
                    <TrainingTierBadge tier={item.tier} />
                  </div>
                  <p className="mt-0.5 text-xs text-ds-muted">{item.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {categories.length > 0 ? (
        <section aria-labelledby="ml-matrix-heading" className="space-y-4">
          <h2 id="ml-matrix-heading" className="text-sm font-bold uppercase tracking-wide text-ds-muted">
            Training matrix by category
          </h2>
          <div className="grid gap-5 lg:grid-cols-2">
            {categories.map((cat) => (
              <CategoryCard key={cat.id} category={cat} />
            ))}
          </div>
        </section>
      ) : null}

      <section
        aria-labelledby="ml-ack-heading"
        className="rounded-2xl border border-ds-border bg-ds-secondary/25 p-5"
      >
        <h2 id="ml-ack-heading" className="text-sm font-bold uppercase tracking-wide text-ds-muted">
          Acknowledgement history
        </h2>
        <ul className="mt-4 space-y-3">
          {recentAcknowledgements.length === 0 ? (
            <li className="text-sm text-ds-muted">No acknowledgement records on file.</li>
          ) : (
            recentAcknowledgements.map((ack) => (
              <li
                key={ack.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-ds-border/70 bg-ds-primary/60 px-4 py-3"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ background: "linear-gradient(135deg, var(--ml-primary) 0%, #4db8c4 100%)" }}
                >
                  <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ds-foreground">{ack.title}</p>
                  <p className="text-xs text-ds-muted">Revision {ack.revision}</p>
                </div>
                <span className="shrink-0 rounded-md border border-ds-border bg-ds-secondary/80 px-2 py-1 text-xs font-semibold tabular-nums text-ds-muted">
                  {ack.dateLabel}
                </span>
                <span className="w-full shrink-0 rounded-md bg-[color-mix(in_srgb,var(--ml-success)_10%,transparent)] px-2 py-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--ml-success)] sm:w-auto">
                  Acknowledged
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
