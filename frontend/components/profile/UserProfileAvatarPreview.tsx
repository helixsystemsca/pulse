"use client";

/**
 * Profile image from `avatar_url` (public URL or API path like `/api/v1/profile/avatar`).
 */
import { User } from "lucide-react";
import { useResolvedAvatarSrc } from "@/lib/useResolvedAvatarSrc";

/** Two-letter avatar fallback: first + last initial when possible (not first two chars of one word). */
export function initialsFromDisplayName(raw: string | null | undefined): string {
  const s = raw?.trim() || "";
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? "";
    const b = parts[parts.length - 1]?.[0] ?? "";
    const out = (a + b).toUpperCase();
    return out || "?";
  }
  if (s.includes("@")) {
    const local = s.split("@")[0]?.trim() || "";
    return (local.slice(0, 2) || "?").toUpperCase();
  }
  return (s.slice(0, 2) || "?").toUpperCase();
}

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
  const initials = initialsFromDisplayName(nameFallback);

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
