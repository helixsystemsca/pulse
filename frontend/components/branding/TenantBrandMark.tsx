"use client";

/**
 * Tenant logo from session (upload or https URL) with a platform wordmark fallback.
 * Used on kiosks and other surfaces that should not hardcode Panorama assets.
 */
import { useAuthenticatedAssetSrc } from "@/hooks/useAuthenticatedAssetSrc";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { PLATFORM_DEFAULT_LOGO_SRC } from "@/lib/branding/platform-defaults";
import { cn } from "@/lib/cn";

type Props = {
  className?: string;
  logoUrl?: string | null;
  companyName?: string | null;
};

export function TenantBrandMark({ className = "", logoUrl, companyName }: Props) {
  const { session } = usePulseAuth();
  const tenantLogoUrl = (logoUrl ?? session?.company?.logo_url ?? "").trim() || null;
  const alt = (companyName ?? session?.company?.name ?? "Organization").trim() || "Organization";
  const apiBlob = useAuthenticatedAssetSrc(tenantLogoUrl);
  const external =
    tenantLogoUrl?.startsWith("http://") || tenantLogoUrl?.startsWith("https://") ? tenantLogoUrl : null;
  const waitingApiBlob = Boolean(tenantLogoUrl?.startsWith("/api") && !apiBlob);

  const displaySrc = external ?? apiBlob ?? (waitingApiBlob ? null : PLATFORM_DEFAULT_LOGO_SRC);

  if (!displaySrc) {
    return (
      <span
        className={cn("inline-block animate-pulse rounded-md bg-ds-secondary/80", className)}
        aria-label={`Loading ${alt} logo`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- tenant https URL or authenticated blob
    <img src={displaySrc} alt={alt} className={cn("object-contain object-left", className)} />
  );
}
