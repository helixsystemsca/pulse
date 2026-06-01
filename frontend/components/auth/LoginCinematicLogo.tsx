"use client";

import Image from "next/image";
import { PLATFORM_DEFAULT_LOGO_SRC } from "@/lib/branding/platform-defaults";
import { cn } from "@/lib/cn";

type Props = {
  layoutClassName?: string;
};

export function LoginCinematicLogo({ layoutClassName }: Props) {
  return (
    <div className={cn("flex w-full justify-center", layoutClassName)}>
      <div className="relative mx-auto h-[7.25rem] w-[min(18rem,calc(100vw-2rem))] shrink-0 sm:h-[8.5rem] sm:w-[min(21rem,calc(100vw-2rem))] md:h-[9.5rem] md:w-[min(24rem,calc(100vw-2.5rem))]">
        <div
          className="pointer-events-none absolute inset-[-10%] rounded-[40%] bg-[radial-gradient(ellipse_at_center,rgba(86,201,217,0.18)_0%,transparent_70%)] opacity-80"
          aria-hidden
        />
        <Image
          src={PLATFORM_DEFAULT_LOGO_SRC}
          alt="Helix Systems"
          fill
          priority
          sizes="(max-width: 640px) 90vw, 30rem"
          className="object-contain object-center [image-rendering:auto]"
        />
      </div>
    </div>
  );
}
