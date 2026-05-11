"use client";

import { Mail, MapPin, Pencil, Phone, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { AvatarUpload } from "@/components/common/AvatarUpload";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

export type ProfileIdentityBadge = {
  key: string;
  label: string;
  tone: "teal" | "cobalt" | "amber" | "coral" | "slate";
};

const badgeTone: Record<ProfileIdentityBadge["tone"], string> = {
  teal: "border-[#36F1CD]/35 bg-[#36F1CD]/12 text-[#0b5c4d] dark:text-[#7efce3]",
  cobalt: "border-[#2B4C7E]/30 bg-[#2B4C7E]/10 text-[#2B4C7E]",
  amber: "border-amber-400/35 bg-amber-400/12 text-amber-800 dark:text-amber-200",
  coral: "border-[#e8706f]/40 bg-[#e8706f]/14 text-[#9b3d38]",
  slate: "border-ds-border bg-ds-secondary/80 text-ds-muted",
};

export function ProfileHeaderCard({
  displayName,
  email,
  phone,
  roleLabel,
  department,
  facilityLabel,
  accountStatus,
  badges,
  avatarUrl,
  userId,
  microsoftAuth,
  onAvatarUploaded,
  onEditClick,
  portraitRingClassName,
  portraitAnimatedClassName,
  equippedTitle,
  featuredBadges,
  onAppearanceClick,
}: {
  displayName: string;
  email: string;
  phone: string | null;
  roleLabel: string;
  department: string | null;
  facilityLabel: string | null;
  accountStatus: string;
  badges: ProfileIdentityBadge[];
  avatarUrl: string | null;
  userId: string;
  microsoftAuth?: boolean;
  onAvatarUploaded: (next: string) => void;
  onEditClick: () => void;
  portraitRingClassName?: string;
  portraitAnimatedClassName?: string;
  equippedTitle?: string | null;
  featuredBadges?: { id: string; name: string }[];
  onAppearanceClick?: () => void;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/25 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.55)]",
        "bg-[linear-gradient(135deg,color-mix(in_srgb,var(--ds-palette-ice-deep)_82%,transparent)_0%,color-mix(in_srgb,var(--ds-surface-primary)_96%,#36F1CD)_48%,color-mix(in_srgb,var(--ds-surface-primary)_94%,#4C6085)_100%)]",
        "dark:bg-[linear-gradient(135deg,#0c1424_0%,#152032_45%,#13202e_100%)]",
      )}
    >
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#36F1CD]/18 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[#4C6085]/25 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-8 sm:flex-row sm:items-start">
          <div className="relative mx-auto shrink-0 sm:mx-0">
            <div
              className={cn(
                "rounded-full bg-white/30 p-1.5 shadow-[0_12px_40px_rgba(15,23,42,0.25)] backdrop-blur-md",
                "dark:bg-white/10 dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
                portraitRingClassName,
                portraitAnimatedClassName,
              )}
            >
              <AvatarUpload
                userId={userId}
                currentAvatarUrl={avatarUrl}
                displayName={displayName || email}
                size="h-36 w-36"
                className="[&_img]:rounded-full [&_span]:rounded-full"
                onUploadComplete={onAvatarUploaded}
              />
            </div>
            <span className="pointer-events-none absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/90 text-[#2B4C7E] shadow-md dark:border-white/10 dark:bg-[#1a2838] dark:text-[#36F1CD]">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-4 text-center sm:text-left">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--ds-muted)_92%,#fff)] dark:text-ds-muted">
                Your workforce identity
              </p>
              <h1 className="mt-2 font-headline text-3xl font-extrabold tracking-tight text-ds-foreground sm:text-4xl">
                {displayName || email || "Member"}
              </h1>
              {equippedTitle ? (
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-[#2B4C7E]/85 dark:text-[#7dd3fc]/90">
                  {equippedTitle}
                </p>
              ) : null}
              <p className="mt-2 text-base font-semibold text-[color-mix(in_srgb,var(--ds-foreground)_88%,#36F1CD)] dark:text-ds-foreground/90">
                {roleLabel}
              </p>
              {featuredBadges && featuredBadges.length > 0 ? (
                <ul className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                  {featuredBadges.map((b) => (
                    <li
                      key={b.id}
                      className="rounded-full border border-white/35 bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1e3a5f] backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-[#bae6fd]"
                    >
                      {b.name}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {badges.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                {badges.map((b) => (
                  <span
                    key={b.key}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide backdrop-blur-sm",
                      badgeTone[b.tone],
                    )}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            ) : null}

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex items-start gap-2 rounded-xl border border-white/20 bg-white/15 px-3 py-2.5 backdrop-blur-md dark:border-white/10 dark:bg-black/20">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ds-muted" aria-hidden />
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-ds-muted">Team &amp; location</dt>
                  <dd className="mt-0.5 font-semibold text-ds-foreground">
                    {[department, facilityLabel].filter(Boolean).join(" · ") || "—"}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-white/20 bg-white/15 px-3 py-2.5 backdrop-blur-md dark:border-white/10 dark:bg-black/20">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ds-muted" aria-hidden />
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-ds-muted">Status</dt>
                  <dd className="mt-0.5 font-semibold text-ds-foreground">{accountStatus}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-white/20 bg-white/15 px-3 py-2.5 backdrop-blur-md dark:border-white/10 dark:bg-black/20 sm:col-span-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-ds-muted" aria-hidden />
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-ds-muted">Contact</dt>
                  <dd className="mt-0.5 truncate font-semibold text-ds-foreground">{email}</dd>
                  {phone ? (
                    <dd className="mt-1 flex items-center gap-1.5 font-semibold text-ds-foreground/90">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-ds-muted" aria-hidden />
                      {phone}
                    </dd>
                  ) : (
                    <dd className="mt-1 text-xs font-medium text-ds-muted">No phone on file</dd>
                  )}
                </div>
              </div>
            </dl>

            {microsoftAuth ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-[#4c6085]/20 bg-white/25 px-3 py-1.5 text-xs font-bold text-[#2f3d52] backdrop-blur-md dark:border-ds-border dark:bg-ds-secondary/60 dark:text-ds-foreground">
                <span className="grid h-3.5 w-3.5 grid-cols-2 gap-[1px]" aria-hidden>
                  <span className="bg-[#f25022]" />
                  <span className="bg-[#7fba00]" />
                  <span className="bg-[#00a4ef]" />
                  <span className="bg-[#ffb900]" />
                </span>
                Signed in with Microsoft
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 lg:justify-end">
          {onAppearanceClick ? (
            <button
              type="button"
              onClick={onAppearanceClick}
              className={cn(
                buttonVariants({ surface: "light", intent: "secondary" }),
                "inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/80 px-4 py-2.5 text-sm font-bold shadow-md backdrop-blur-md",
                "hover:bg-white dark:border-white/15 dark:bg-[#1e2a3a]/85 dark:hover:bg-[#243447]",
              )}
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Appearance
            </button>
          ) : null}
          <button
            type="button"
            onClick={onEditClick}
            className={cn(
              buttonVariants({ surface: "light", intent: "secondary" }),
              "inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/90 px-4 py-2.5 text-sm font-bold shadow-md backdrop-blur-md",
              "hover:bg-white dark:border-white/15 dark:bg-[#1e2a3a]/90 dark:hover:bg-[#243447]",
            )}
            aria-label="Edit profile"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Edit profile
          </button>
        </div>
      </div>

      <div className="relative border-t border-white/15 bg-black/[0.06] px-6 py-3 dark:border-white/10 dark:bg-black/25">
        <p className="text-center text-[11px] font-semibold text-ds-muted sm:text-left">
          Emergency contacts are managed by your supervisor or HR in{" "}
          <Link href="/dashboard/workers" className="font-bold text-[#2B4C7E] underline-offset-2 hover:underline dark:text-[#36F1CD]">
            Team Management
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
