"use client";

/**
 * Profile image from `avatar_url` (public URL or API path like `/api/v1/profile/avatar`).
 */
import { User } from "lucide-react";
import { useResolvedAvatarSrc } from "@/lib/useResolvedAvatarSrc";

type Props = {
  avatarUrl?: string | null;
  nameFallback?: string | null;
  className?: string;
  sizeClassName?: string;
  /** Compact surfaces (e.g. header): initials only. Default shows icon + initials. */
  fallback?: "profile" | "initials";
};

export function UserProfileAvatarPreview({
  avatarUrl,
  nameFallback,
  className = "",
  sizeClassName = "h-24 w-24",
  fallback = "profile",
}: Props) {
  const src = useResolvedAvatarSrc(avatarUrl ?? null);
  const initials = (nameFallback?.trim() || "?").slice(0, 2).toUpperCase();

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-ds-border bg-ds-secondary text-ds-muted ring-2 ring-ds-primary ${sizeClassName} ${className}`.trim()}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : fallback === "initials" ? (
        <span className="text-xs font-bold">{initials}</span>
      ) : (
        <span className="flex flex-col items-center justify-center gap-0.5 text-center">
          <User className="h-8 w-8 opacity-60" strokeWidth={1.5} aria-hidden />
          <span className="text-[10px] font-bold">{initials}</span>
        </span>
      )}
    </div>
  );
}
