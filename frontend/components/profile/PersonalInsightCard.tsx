"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/pulse/Card";
import { cn } from "@/lib/cn";

export type InsightAccent = "teal" | "cobalt" | "amber" | "coral" | "slate";

const accentRing: Record<InsightAccent, string> = {
  teal: "bg-[#36F1CD]/15 text-[#0E7C66]",
  cobalt: "bg-[#2B4C7E]/12 text-[#2B4C7E]",
  amber: "bg-amber-400/15 text-amber-600 dark:text-amber-400",
  coral: "bg-[#e8706f]/18 text-[#c44f4a]",
  slate: "bg-ds-secondary/70 text-ds-muted",
};

export function PersonalInsightCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "teal",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string | null;
  icon: LucideIcon;
  accent?: InsightAccent;
  className?: string;
}) {
  return (
    <Card
      padding="md"
      variant="primary"
      className={cn(
        "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--ds-shadow-card-hover)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ds-muted">{label}</p>
          <div className="mt-2 font-headline text-2xl font-extrabold tabular-nums text-ds-foreground">{value}</div>
          {hint ? <p className="mt-1 text-xs font-semibold text-ds-muted">{hint}</p> : null}
        </div>
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            accentRing[accent],
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </Card>
  );
}

export function InsightMetricGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5", className)}>{children}</div>;
}
