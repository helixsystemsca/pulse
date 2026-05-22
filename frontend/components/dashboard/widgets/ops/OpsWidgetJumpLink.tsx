"use client";

import Link from "next/link";
import { SquareArrowOutUpRight } from "lucide-react";

import { cn } from "@/lib/cn";

/** Compact jump-to-module control for widget shell headers. */
export function OpsWidgetJumpLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "ops-widget-jump inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[rgb(226_232_240)] bg-white text-[var(--ds-accent)] shadow-[0_1px_0_rgb(255_255_255)_inset,0_2px_6px_-2px_rgb(15_23_42/0.1)] transition hover:border-[color-mix(in_srgb,var(--ds-accent)_35%,transparent)] hover:bg-[color-mix(in_srgb,var(--ds-accent)_8%,#fff)] hover:shadow-[0_2px_8px_-2px_rgb(56_189_248/0.25)]",
        className,
      )}
      aria-label={label}
      title={label}
    >
      <SquareArrowOutUpRight className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
    </Link>
  );
}
