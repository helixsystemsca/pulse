"use client";

import Image from "next/image";
import { PLATFORM_DEFAULT_LOGO_SRC } from "@/lib/branding/platform-defaults";
import { cn } from "@/lib/cn";

type Props = {
  layoutClassName?: string;
};

export function LoginCinematicLogo({ layoutClassName }: Props) {
  return (
    <div className={cn("flex w-full flex-col items-center", layoutClassName)}>
      <div className="login-cinematic-logo__mark relative mx-auto h-[7.25rem] w-[min(18rem,calc(100vw-2rem))] shrink-0 sm:h-[8.5rem] sm:w-[min(21rem,calc(100vw-2rem))] md:h-[9.5rem] md:w-[min(24rem,calc(100vw-2.5rem))]">
        <div
          className="pointer-events-none absolute inset-[-10%] rounded-[40%] bg-[radial-gradient(ellipse_at_center,rgba(86,201,217,0.18)_0%,transparent_70%)] opacity-80"
          aria-hidden
        />
        <Image
          src={PLATFORM_DEFAULT_LOGO_SRC}
          alt="Helix"
          fill
          priority
          sizes="(max-width: 640px) 90vw, 30rem"
          className="object-contain object-center [image-rendering:auto]"
        />
      </div>
      <p className="mt-3 text-center text-sm font-semibold uppercase tracking-[0.18em] text-[#4c6085] dark:text-ds-muted sm:mt-3.5">
        Operations Platform
      </p>
    </div>
  );
}
