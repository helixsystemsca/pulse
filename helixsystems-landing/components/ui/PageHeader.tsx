"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: string;
  description?: string;
  /** Option A: icon on every feature header for visual consistency. */
  icon: LucideIcon;
  actions?: ReactNode;
  variant?: "light" | "dark";
  className?: string;
};

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  variant = "light",
  className = "",
}: PageHeaderProps) {
  const dark = variant === "dark";
  return (
    <div
      id="page-header"
      className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`.trim()}
    >
      <div className="flex min-w-0 gap-3">
        <span
          className={
            dark
              ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 shadow-sm"
              : "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-[#2B4C7E] shadow-sm"
          }
          aria-hidden
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h1
            className={`font-headline text-2xl font-bold tracking-tight md:text-3xl ${
              dark ? "text-white" : "text-pulse-navy"
            }`}
          >
            {title}
          </h1>
          {description ? (
            <p className={`mt-1 text-sm leading-relaxed ${dark ? "text-zinc-400" : "text-pulse-muted"}`}>
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
