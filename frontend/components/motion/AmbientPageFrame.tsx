"use client";

import type { ReactNode } from "react";
import { OperationsAmbientBackground } from "@/components/motion/OperationsAmbientBackground";
import { cn } from "@/lib/cn";

/** Wraps page content with a fixed atmospheric layer behind (z-0); children stay z-10. */
export function AmbientPageFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative isolate min-h-0 flex-1", className)}>
      <OperationsAmbientBackground className="z-0" />
      <div className="relative z-[1] min-h-0 flex-1">{children}</div>
    </div>
  );
}
