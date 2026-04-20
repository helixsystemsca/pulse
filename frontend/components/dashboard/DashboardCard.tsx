import type { ReactNode } from "react";

export type DashboardAccent = "yellow" | "red" | "blue" | "green" | "none";

/**
 * Dashboard cards should match the Pulse theme.
 * We use a solid, token-backed header bar (aquamarine / `--ds-success`) instead of pastel gradients.
 *
 * `accent` is kept for API compatibility; it's currently used only for subtle header meta styling.
 */
const ACCENT_HEADER: Record<DashboardAccent, { headerMeta: string }> = {
  yellow: { headerMeta: "text-white/90" },
  red: { headerMeta: "text-white/90" },
  blue: { headerMeta: "text-white/90" },
  green: { headerMeta: "text-white/90" },
  none: { headerMeta: "text-white/90" },
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
  const hasHeader = Boolean(title || headerRight);
  return (
    <section
      className={[
        "relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-ds-primary dark:shadow-none",
        "transition-shadow duration-200 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)]",
        className ?? "",
      ].join(" ")}
    >
      {title || headerRight ? (
        <div className="relative bg-[#4C6085]">
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            {title ? (
              <h3 className="text-[15px] font-bold leading-tight tracking-tight text-white">{title}</h3>
            ) : (
              <span />
            )}
            {headerRight ? <div className={["shrink-0", a.headerMeta].join(" ")}>{headerRight}</div> : null}
          </div>
        </div>
      ) : null}
      <div className={["flex-1 min-h-0 px-5 pb-5", hasHeader ? "pt-2" : "pt-5", bodyClassName ?? ""].join(" ")}>
        {children}
      </div>
    </section>
  );
}

