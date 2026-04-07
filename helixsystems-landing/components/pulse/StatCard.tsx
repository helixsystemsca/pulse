import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "./Card";

type StatBlockProps = {
  label: string;
  tone?: "blue" | "gray" | "red" | "amber";
};

export function StatBlock({ label, tone = "gray" }: StatBlockProps) {
  const tones = {
    blue: "bg-blue-50 text-blue-800 border-blue-100",
    gray: "bg-slate-50 text-slate-800 border-slate-200",
    red: "bg-red-50 text-red-700 border-red-100",
    amber: "bg-amber-50 text-amber-800 border-amber-100",
  } as const;

  return (
    <div
      className={`rounded-md border px-3 py-2.5 text-center text-xs font-semibold leading-snug sm:text-sm ${tones[tone]}`}
    >
      {label}
    </div>
  );
}

type StatCardProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export function StatCard({ icon: Icon, title, subtitle, children, className = "" }: StatCardProps) {
  return (
    <Card className={className} padding="lg">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-pulse-accent">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-sm font-semibold text-pulse-navy sm:text-base">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-pulse-muted sm:text-sm">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </Card>
  );
}
