import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "./Card";

type FeatureCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  iconClassName?: string;
  variant?: "default" | "alert";
};

export function FeatureCard({
  icon: Icon,
  title,
  description,
  iconClassName = "text-ds-success",
  variant = "default",
}: FeatureCardProps) {
  return (
    <Card
      className={`flex gap-4 ${variant === "alert" ? "border-[color-mix(in_srgb,var(--ds-danger)_40%,var(--ds-border))]" : ""}`}
      variant="primary"
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-ds-border bg-ds-secondary ${
          variant === "alert" ? "text-ds-danger" : ""
        } ${iconClassName}`}
      >
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <h3 className="text-lg font-semibold text-ds-foreground">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ds-muted">{description}</p>
      </div>
    </Card>
  );
}

type SmallFeatureCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

export function SmallFeatureCard({ icon, title, description }: SmallFeatureCardProps) {
  return (
    <Card className="flex items-start gap-3 !p-5 shadow-[var(--ds-shadow-card)] md:!p-6" variant="primary">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-ds-border bg-ds-secondary text-ds-success">
        {icon}
      </div>
      <div className="min-w-0">
        <h4 className="font-semibold text-ds-foreground">{title}</h4>
        <p className="mt-1.5 text-sm leading-relaxed text-ds-muted">{description}</p>
      </div>
    </Card>
  );
}
