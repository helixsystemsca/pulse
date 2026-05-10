"use client";

import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/pulse/Card";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

export type RecommendationItem = {
  id: string;
  title: string;
  detail: string;
  href?: string;
  actionLabel?: string;
  accent?: "teal" | "amber" | "coral";
};

const accentBar: Record<NonNullable<RecommendationItem["accent"]>, string> = {
  teal: "bg-[#36F1CD]",
  amber: "bg-amber-400",
  coral: "bg-[#e8706f]",
};

export function ProfileRecommendationsSection({
  title = "Focus & opportunities",
  subtitle = "Personalized signals from your training, certifications, and schedule.",
  items,
  footer,
}: {
  title?: string;
  subtitle?: string;
  items: RecommendationItem[];
  footer?: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-headline text-lg font-extrabold text-ds-foreground">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#36F1CD]/15 text-[#0E7C66]">
              <Lightbulb className="h-4 w-4" aria-hidden />
            </span>
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ds-muted">{subtitle}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.length === 0 ? (
          <Card padding="lg" variant="secondary" className="lg:col-span-2">
            <p className="text-sm font-semibold text-ds-foreground">You&apos;re all caught up</p>
            <p className="mt-1 text-sm text-ds-muted">
              As new training assignments, expiring certifications, or announcements arrive, they&apos;ll surface here.
            </p>
          </Card>
        ) : (
          items.map((it) => (
            <Card
              key={it.id}
              padding="md"
              variant="elevated"
              className="relative overflow-hidden transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--ds-shadow-card-hover)]"
            >
              <div
                className={cn(
                  "absolute left-0 top-0 h-full w-1 rounded-r",
                  accentBar[it.accent ?? "teal"],
                )}
                aria-hidden
              />
              <div className="pl-3">
                <p className="text-sm font-extrabold text-ds-foreground">{it.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ds-muted">{it.detail}</p>
                {it.href && it.actionLabel ? (
                  <Link
                    href={it.href}
                    className={cn(
                      buttonVariants({ surface: "light", intent: "secondary" }),
                      "mt-3 inline-flex rounded-lg px-3 py-1.5 text-xs font-bold",
                    )}
                  >
                    {it.actionLabel}
                  </Link>
                ) : null}
              </div>
            </Card>
          ))
        )}
      </div>
      {footer}
    </section>
  );
}
