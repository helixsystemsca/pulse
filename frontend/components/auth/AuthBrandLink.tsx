import Link from "next/link";
import { pulseRoutes } from "@/lib/pulse-app";

export function AuthBrandLink() {
  return (
    <Link
      href={pulseRoutes.pulseLanding}
      className="flex items-center gap-2.5 font-panoramaBrand text-base uppercase text-ds-foreground no-underline transition-opacity hover:opacity-90 sm:text-lg"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ds-border bg-ds-secondary shadow-sm">
        <img src="/images/pulse-mark.svg" width={36} height={36} alt="" className="h-9 w-9 object-cover" />
      </span>
      <span className="inline-flex items-baseline gap-[0.06em] leading-none tracking-normal">
        <span className="font-normal tracking-[0.06em]">Panorama</span>
        <span className="font-light tracking-[0.06em]">Pulse</span>
      </span>
    </Link>
  );
}
