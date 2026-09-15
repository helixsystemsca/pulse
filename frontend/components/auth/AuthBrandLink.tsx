"use client";

import Image from "next/image";
import Link from "next/link";
import { CinematicLogoImage } from "@/components/branding/CinematicLogoImage";
import { pulseRoutes } from "@/lib/pulse-app";
import { useAuthBrand } from "@/lib/branding/use-auth-brand";

export function AuthBrandLink() {
  const brand = useAuthBrand();
  const isVernon = brand.kind === "vernon";

  return (
    <Link
      href={pulseRoutes.pulseLanding}
      className="flex items-center gap-2.5 font-panoramaBrand text-base uppercase text-ds-foreground no-underline transition-opacity hover:opacity-90 sm:text-lg"
    >
      {isVernon ? (
        <span className="relative h-10 w-[min(12.5rem,70vw)] shrink-0">
          <CinematicLogoImage
            src={brand.cinematicSrc}
            alt={brand.cinematicAlt}
            sizes="200px"
            className="object-contain object-left"
          />
        </span>
      ) : (
        <>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ds-border bg-ds-secondary shadow-sm">
            <Image
              src="/images/pulse-mark.svg"
              width={36}
              height={36}
              alt=""
              className="h-9 w-9 object-cover"
              unoptimized
            />
          </span>
          <span className="font-semibold tracking-[0.06em] leading-none">Helix</span>
        </>
      )}
    </Link>
  );
}
