"use client";

import { useResolvedAvatarSrc } from "@/lib/useResolvedAvatarSrc";
import { cn } from "@/lib/cn";
import { displayName } from "@/lib/team-management/development-types";

function initials(name: string | null | undefined, email: string): string {
  const base = (name || email || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function DevelopmentEmployeeAvatar({
  avatarUrl,
  fullName,
  email,
  size = "md",
  className,
}: {
  avatarUrl?: string | null;
  fullName: string | null;
  email: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const src = useResolvedAvatarSrc(avatarUrl ?? null);
  const dim =
    size === "lg" ? "h-12 w-12 text-sm" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ds-secondary font-bold text-ds-foreground ring-1 ring-ds-border",
        dim,
        className,
      )}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(fullName, email)
      )}
    </span>
  );
}

export function DevelopmentEmployeeChip({
  avatarUrl,
  fullName,
  email,
  jobTitle,
  onClick,
}: {
  avatarUrl?: string | null;
  fullName: string | null;
  email: string;
  jobTitle?: string | null;
  onClick?: () => void;
}) {
  const name = displayName({ full_name: fullName, email });
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-[9rem] max-w-[11rem] flex-col items-center gap-1.5 rounded-xl border border-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] bg-white/80 px-2 py-2 text-center shadow-sm transition hover:border-[color-mix(in_srgb,var(--ds-accent)_35%,transparent)] hover:shadow-md dark:bg-ds-secondary/60"
    >
      <DevelopmentEmployeeAvatar avatarUrl={avatarUrl} fullName={fullName} email={email} size="md" />
      <span className="w-full truncate text-xs font-bold text-ds-foreground">{name}</span>
      {jobTitle ? (
        <span className="w-full truncate text-[10px] font-medium text-ds-muted">{jobTitle}</span>
      ) : null}
    </button>
  );
}
