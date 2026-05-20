"use client";

type Props = {
  title: string;
  description: string;
};

export function PlanningPlaceholderTab({ title, description }: Props) {
  return (
    <div className="rounded-xl border border-dashed border-ds-border/80 bg-ds-secondary/20 px-8 py-16 text-center">
      <h2 className="text-lg font-semibold text-ds-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ds-muted">{description}</p>
    </div>
  );
}
