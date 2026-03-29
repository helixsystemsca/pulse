"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { pulseRoutes } from "@/lib/pulse-app";

type PulseDashboardLinkProps = {
  className: string;
  children: ReactNode;
};

/** Routes to `/overview` when signed in, otherwise `/login`. */
export function PulseDashboardLink({ className, children }: PulseDashboardLinkProps) {
  const { authed } = usePulseAuth();
  const href = authed ? pulseRoutes.overview : pulseRoutes.login;
  const isLogin = href === pulseRoutes.login;
  return (
    <Link
      href={href}
      className={className}
      {...(isLogin ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </Link>
  );
}
