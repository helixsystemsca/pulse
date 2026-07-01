import { cn } from "@/lib/cn";

const STATUS_STYLES: Record<string, string> = {
  upcoming: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  cancelled: "bg-ds-secondary text-ds-muted",
  open: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  in_progress: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
};

export function MeetingStatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
        STATUS_STYLES[status] ?? "bg-ds-secondary text-ds-muted",
      )}
    >
      {label}
    </span>
  );
}
