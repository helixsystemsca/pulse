import Link from "next/link";
import { pulseRoutes } from "@/lib/pulse-app";

export function AuthBrandLink() {
  return (
    <Link
      href={pulseRoutes.pulseLanding}
      className="flex items-center gap-2.5 font-headline text-lg font-bold tracking-tight text-ds-foreground no-underline transition-opacity hover:opacity-90 sm:text-xl"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ds-border bg-ds-secondary shadow-sm">
        <img src="/images/pulse-mark.svg" width={36} height={36} alt="" className="h-9 w-9 object-cover" />
      </span>
      <span>Pulse</span>
    </Link>
  );
}
