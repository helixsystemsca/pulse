"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, DoorOpen, HardHat, MapPin, Phone, ShieldAlert, Stethoscope } from "lucide-react";
import type { SafetyReminderCard, SafetyReminderIconId, SafetyReminderSeverity } from "@/lib/project-kiosk/types";
import { cn } from "@/lib/cn";

const ICONS: Record<SafetyReminderIconId, LucideIcon> = {
  "shield-alert": ShieldAlert,
  "hard-hat": HardHat,
  stethoscope: Stethoscope,
  phone: Phone,
  "door-open": DoorOpen,
  "map-pin": MapPin,
};

const SHELL: Record<
  SafetyReminderSeverity,
  { iconWrap: string; icon: string; tag: string; title: string; desc: string }
> = {
  critical: {
    iconWrap: "border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/35",
    icon: "text-rose-600 dark:text-rose-300",
    tag: "border border-rose-200 bg-rose-50 text-[10px] font-extrabold uppercase tracking-wider text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100",
    title: "text-ds-foreground",
    desc: "text-ds-muted",
  },
  caution: {
    iconWrap: "border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/35",
    icon: "text-amber-700 dark:text-amber-300",
    tag: "border border-amber-200 bg-amber-50 text-[10px] font-extrabold uppercase tracking-wider text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100",
    title: "text-ds-foreground",
    desc: "text-ds-muted",
  },
  info: {
    iconWrap: "border border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/35",
    icon: "text-sky-700 dark:text-sky-300",
    tag: "border border-sky-200 bg-sky-50 text-[10px] font-extrabold uppercase tracking-wider text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100",
    title: "text-ds-foreground",
    desc: "text-ds-muted",
  },
  emergency: {
    iconWrap: "border border-fuchsia-200 bg-fuchsia-50 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/35",
    icon: "text-fuchsia-700 dark:text-fuchsia-300",
    tag: "border border-fuchsia-200 bg-fuchsia-50 text-[10px] font-extrabold uppercase tracking-wider text-fuchsia-950 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/40 dark:text-fuchsia-100",
    title: "text-ds-foreground",
    desc: "text-ds-muted",
  },
};

function SafetyTile({ card }: { card: SafetyReminderCard }) {
  const shell = SHELL[card.severity];
  const Icon = ICONS[card.icon];

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-ds-border bg-ds-primary p-3 shadow-[var(--ds-shadow-card)] sm:p-4">
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg", shell.iconWrap)}>
        <Icon className={cn("h-5 w-5", shell.icon)} aria-hidden />
      </div>
      <span className={cn("mt-3 inline-flex w-fit rounded-full px-2.5 py-1", shell.tag)}>{card.tag}</span>
      <h3 className={cn("mt-2 line-clamp-2 font-headline text-sm font-bold leading-snug sm:text-base", shell.title)}>
        {card.title}
      </h3>
      <p
        className={cn(
          "mt-2 line-clamp-4 flex-1 text-xs leading-relaxed sm:text-sm sm:text-[15px]",
          shell.desc,
          "whitespace-pre-line",
        )}
      >
        {card.description}
      </p>
    </div>
  );
}

export function SafetyRemindersKioskPage({ subtitle, cards }: { subtitle: string; cards: SafetyReminderCard[] }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-ds-secondary/35 px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <div className="mx-auto flex w-full max-w-6xl shrink-0 items-start gap-2.5 sm:gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200 sm:h-11 sm:w-11">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="font-headline text-xl font-bold tracking-tight text-ds-foreground sm:text-2xl md:text-3xl">
            Safety reminders
          </h2>
          <p className="mt-0.5 text-xs text-ds-muted sm:text-sm">{subtitle}</p>
        </div>
      </div>

      <div className="mx-auto mt-4 grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 gap-3 overflow-hidden sm:mt-5 sm:grid-cols-2 sm:gap-4">
        {cards.map((card, i) => (
          <div key={`${card.title}-${i}`} className="flex min-h-0">
            <SafetyTile card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}
