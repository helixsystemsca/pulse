"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { pulseApp, pulseRoutes } from "@/lib/pulse-app";

type PulseDashboardLinkProps = {
  className: string;
  children: ReactNode;
};

/** Routes to app overview when signed in, otherwise Pulse app sign-in URL. */
export function PulseDashboardLink({ className, children }: PulseDashboardLinkProps) {
  const { authed } = usePulseAuth();
  const href = authed ? pulseApp.to(pulseRoutes.overview) : pulseApp.login();
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
