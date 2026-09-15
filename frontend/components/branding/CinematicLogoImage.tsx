"use client";

/**
 * Login / welcome / logout mark. Raster files use next/image; static SVGs use
 * `<img>` because next/image does not serve SVG without dangerouslyAllowSVG.
 */
import Image from "next/image";
import { isStaticSvgLogoUrl } from "@/lib/branding/logo-src";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
};

export function CinematicLogoImage({ src, alt, sizes, className, priority }: Props) {
  if (isStaticSvgLogoUrl(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local static SVG
      <img src={src} alt={alt} className={cn("absolute inset-0 h-full w-full", className)} />
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} className={className} priority={priority} />;
}
