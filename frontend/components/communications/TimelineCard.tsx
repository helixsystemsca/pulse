import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

type TimelineCardProps = {
  title: string;
  subtitle?: string;
  /** ISO date range label */
  rangeLabel: string;
  accent?: "violet" | "sky" | "amber" | "rose" | "emerald";
  children?: ReactNode;
  className?: string;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
};

const ACCENT_BAR: Record<NonNullable<TimelineCardProps["accent"]>, string> = {
  violet: "bg-violet-500/80",
  sky: "bg-sky-500/80",
  amber: "bg-amber-500/80",
  rose: "bg-rose-500/80",
  emerald: "bg-emerald-500/80",
};

export function TimelineCard({
  title,
  subtitle,
  rangeLabel,
  accent = "sky",
  children,
  className,
  draggable,
  onDragStart,
  onDragEnd,
}: TimelineCardProps) {
  return (
    <motion.div
      layout
      drag={draggable ? "x" : false}
      dragConstraints={{ left: -40, right: 40 }}
      dragElastic={0.12}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-ds-border bg-ds-primary/95 shadow-[var(--ds-shadow-card)]",
        draggable && "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      <div className={cn("absolute left-0 top-0 h-full w-1", ACCENT_BAR[accent])} aria-hidden />
      <div className="p-3 pl-4">
        <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">{rangeLabel}</p>
        <p className="mt-1 text-sm font-semibold text-ds-foreground">{title}</p>
        {subtitle ? <p className="mt-0.5 text-xs text-ds-muted">{subtitle}</p> : null}
        {children ? <div className="mt-2">{children}</div> : null}
      </div>
    </motion.div>
  );
}
