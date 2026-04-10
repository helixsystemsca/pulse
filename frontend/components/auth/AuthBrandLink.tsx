import Link from "next/link";
import { Activity } from "lucide-react";
import { pulseRoutes } from "@/lib/pulse-app";

export function AuthBrandLink() {
  return (
    <Link
      href={pulseRoutes.pulseLanding}
      className="flex items-center gap-2.5 font-headline text-lg font-bold tracking-tight text-ds-foreground no-underline transition-opacity hover:opacity-90 sm:text-xl"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ds-border bg-ds-secondary text-ds-success shadow-sm">
        <Activity className="h-4 w-4" strokeWidth={2} aria-hidden />
      </span>
      <span>Pulse</span>
    </Link>
  );
}
