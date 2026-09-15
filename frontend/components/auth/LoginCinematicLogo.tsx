"use client";

import Image from "next/image";
import { HelixMarketingLogo } from "@/components/branding/HelixMarketingLogo";
import { helixMarketingHref } from "@/lib/pulse-app";
import type { AuthBrand } from "@/lib/branding/auth-brand";
import { useAuthBrand } from "@/lib/branding/use-auth-brand";
import { cn } from "@/lib/cn";

type Props = {
  layoutClassName?: string;
  /** From the login server page so Vernon hosts skip a Helix→Vernon flash. */
  brand?: AuthBrand;
};

export function LoginCinematicLogo({ layoutClassName, brand: brandProp }: Props) {
  const brand = useAuthBrand(brandProp);

  return (
    <div className={cn("flex w-full flex-col items-center", layoutClassName)}>
      <div className="login-cinematic-logo__mark relative mx-auto h-[7.25rem] w-[min(18rem,calc(100vw-2rem))] shrink-0 sm:h-[8.5rem] sm:w-[min(21rem,calc(100vw-2rem))] md:h-[9.5rem] md:w-[min(24rem,calc(100vw-2.5rem))]">
        <div
          className={cn(
            "pointer-events-none absolute inset-[-10%] rounded-[40%] opacity-80",
            brand.kind === "vernon"
              ? "bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.72)_0%,transparent_72%)]"
              : "bg-[radial-gradient(ellipse_at_center,rgba(86,201,217,0.18)_0%,transparent_70%)]",
          )}
          aria-hidden
        />
        <Image
          src={brand.cinematicSrc}
          alt={brand.cinematicAlt}
          fill
          priority
          sizes="(max-width: 640px) 90vw, 30rem"
          className="object-contain object-center [image-rendering:auto]"
        />
      </div>
      <p className="mt-2 text-center text-sm font-semibold uppercase tracking-[0.18em] text-[#4c6085] dark:text-ds-muted sm:mt-2.5">
        Operations Platform
      </p>
      {brand.showPoweredByHelix ? (
        <a
          href={helixMarketingHref("/")}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 flex items-center justify-center gap-2 text-[11px] font-medium text-[#7a8aa0] no-underline transition-opacity hover:opacity-80 dark:text-ds-muted"
        >
          <span className="uppercase tracking-[0.14em]">Powered by</span>
          <HelixMarketingLogo variant="compact" className="opacity-90" />
        </a>
      ) : null}
    </div>
  );
}
