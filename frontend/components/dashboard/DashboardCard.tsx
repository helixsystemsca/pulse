import type { ReactNode } from "react";

export type DashboardAccent = "yellow" | "red" | "blue" | "green" | "none";

const ACCENT_BG: Record<DashboardAccent, string> = {
  yellow: "bg-yellow-400",
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  none: "bg-transparent",
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
  return (
    <section
      className={[
        "relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)]",
        "transition-shadow duration-200 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)]",
        className ?? "",
      ].join(" ")}
    >
      <div className={`h-1 w-full ${ACCENT_BG[accent]}`} aria-hidden />
      {title || headerRight ? (
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
          {title ? <h3 className="text-[18px] font-semibold leading-tight text-slate-900">{title}</h3> : <span />}
          {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
        </div>
      ) : null}
      <div className={["flex-1 min-h-0 px-5 pb-5", bodyClassName ?? ""].join(" ")}>
        {children}
      </div>
    </section>
  );
}

