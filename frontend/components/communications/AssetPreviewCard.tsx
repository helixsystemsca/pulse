import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type AssetPreviewCardProps = {
  title: string;
  subtitle?: string;
  /** Placeholder for future signed URL / Supabase storage */
  state?: "empty" | "loading" | "ready";
  className?: string;
};

export function AssetPreviewCard({ title, subtitle, state = "empty", className }: AssetPreviewCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-dashed border-ds-border bg-ds-secondary/25 transition-colors hover:border-[var(--ds-accent)]/35 hover:bg-ds-secondary/40",
        className,
      )}
    >
      <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-ds-secondary/50 to-ds-primary">
        {state === "ready" ? (
          <div className="text-center text-xs font-medium text-ds-muted">Preview ready (wire storage)</div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-ds-muted">
            <ImageIcon className="h-8 w-8 opacity-50" strokeWidth={1.25} aria-hidden />
            <span className="text-[11px]">Asset placeholder</span>
          </div>
        )}
      </div>
      <div className="border-t border-ds-border/80 p-3">
        <p className="text-sm font-semibold text-ds-foreground">{title}</p>
        {subtitle ? <p className="mt-0.5 text-xs text-ds-muted">{subtitle}</p> : null}
      </div>
    </div>
  );
}
