import type { ReactNode } from "react";

export type DashboardAccent = "yellow" | "red" | "blue" | "green" | "none";

const ACCENT_HEADER: Record<DashboardAccent, { bar: string; header: string; title: string }> = {
  yellow: {
    bar: "bg-amber-400/70 dark:bg-amber-300/50",
    header: "bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/35 dark:to-ds-primary",
    title: "text-slate-900 dark:text-ds-foreground",
  },
  red: {
    bar: "bg-rose-400/70 dark:bg-rose-300/50",
    header: "bg-gradient-to-b from-rose-50 to-white dark:from-rose-950/30 dark:to-ds-primary",
    title: "text-slate-900 dark:text-ds-foreground",
  },
  blue: {
    bar: "bg-sky-400/70 dark:bg-sky-300/50",
    header: "bg-gradient-to-b from-sky-50 to-white dark:from-sky-950/30 dark:to-ds-primary",
    title: "text-slate-900 dark:text-ds-foreground",
  },
  green: {
    bar: "bg-emerald-400/70 dark:bg-emerald-300/50",
    header: "bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/30 dark:to-ds-primary",
    title: "text-slate-900 dark:text-ds-foreground",
  },
  none: {
    bar: "bg-transparent",
    header: "bg-transparent",
    title: "text-slate-900 dark:text-ds-foreground",
  },
};

export function DashboardCard({
  title,
  accent = "none",
  children,
  headerRight,
  className,
  bodyClassName,
}: {
  title?: string;
  accent?: DashboardAccent;
  children: ReactNode;
  headerRight?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const a = ACCENT_HEADER[accent];
  return (
    <section
      className={[
        "relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-ds-primary dark:shadow-none",
        "transition-shadow duration-200 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)]",
        className ?? "",
      ].join(" ")}
    >
      {title || headerRight ? (
        <div className={["relative", a.header].join(" ")}>
          <div className={["absolute left-0 top-0 h-full w-1", a.bar].join(" ")} aria-hidden />
          <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
            {title ? <h3 className={["text-[18px] font-semibold leading-tight", a.title].join(" ")}>{title}</h3> : <span />}
            {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
          </div>
        </div>
      ) : null}
      <div className={["flex-1 min-h-0 px-5 pb-5", bodyClassName ?? ""].join(" ")}>
        {children}
      </div>
    </section>
  );
}

