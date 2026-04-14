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
}: {
  title?: string;
  accent?: DashboardAccent;
  children: ReactNode;
  headerRight?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)]",
        "transition-shadow duration-200 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)]",
        className ?? "",
      ].join(" ")}
    >
      <div className={`h-1 w-full ${ACCENT_BG[accent]}`} aria-hidden />
      <div className="p-5">
        {title ? (
          <div className="mb-3 flex items-start justify-between gap-3">
            <h3 className="text-[18px] font-semibold leading-tight text-slate-900">{title}</h3>
            {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
          </div>
        ) : headerRight ? (
          <div className="mb-3 flex items-start justify-end">{headerRight}</div>
        ) : null}
        {children}
      </div>
    </section>
  );
}

