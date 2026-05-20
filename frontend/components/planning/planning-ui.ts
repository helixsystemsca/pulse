import type { PlanningIdeaPriority, PlanningIdeaStatus } from "@/lib/planning-ideas/types";
import { cn } from "@/lib/cn";

export function statusBadgeClass(status: PlanningIdeaStatus): string {
  switch (status) {
    case "idea":
      return "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:ring-slate-600";
    case "reviewing":
      return "bg-sky-50 text-sky-800 ring-sky-200/80 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-800";
    case "awaiting_approval":
      return "bg-amber-50 text-amber-900 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800";
    case "approved":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800";
    case "deferred":
      return "bg-violet-50 text-violet-800 ring-violet-200/80 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-800";
    case "rejected":
      return "bg-rose-50 text-rose-800 ring-rose-200/80 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-800";
    case "converted":
      return "bg-ds-secondary/80 text-ds-muted ring-ds-border/80";
    default:
      return "bg-ds-secondary text-ds-muted ring-ds-border";
  }
}

export function priorityBadgeClass(priority: PlanningIdeaPriority): string {
  switch (priority) {
    case "critical":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200";
    case "high":
      return "bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200";
    case "medium":
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
    case "low":
      return "bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400";
    default:
      return "bg-ds-secondary text-ds-muted";
  }
}

export function rowSurfaceClass(converted: boolean): string {
  return cn(
    "group relative rounded-xl border border-ds-border/70 bg-ds-primary/90 transition-shadow",
    converted
      ? "opacity-70 hover:opacity-85"
      : "hover:border-ds-border hover:shadow-sm hover:shadow-black/5 dark:hover:shadow-black/20",
  );
}
