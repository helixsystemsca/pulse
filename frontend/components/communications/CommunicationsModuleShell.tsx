import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type CommunicationsModuleShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function CommunicationsModuleShell({
  eyebrow = "Communications",
  title,
  description,
  actions,
  children,
  className,
}: CommunicationsModuleShellProps) {
  return (
    <div className={cn("mx-auto flex min-h-0 w-full max-w-[1600px] flex-col gap-6", className)}>
      <header className="flex flex-col gap-3 border-b border-ds-border/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ds-muted">{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ds-foreground sm:text-3xl">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ds-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
