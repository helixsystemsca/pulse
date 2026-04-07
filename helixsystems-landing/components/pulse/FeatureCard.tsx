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
  iconClassName = "text-pulse-accent",
  variant = "default",
}: FeatureCardProps) {
  return (
    <Card
      className={`flex gap-4 transition-shadow hover:shadow-lg ${
        variant === "alert" ? "border-red-100/90" : ""
      }`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100/85 dark:bg-slate-800/50 ${
          variant === "alert" ? "text-red-500" : ""
        } ${iconClassName}`}
      >
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <h3 className="text-lg font-semibold text-pulse-navy">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-pulse-muted">{description}</p>
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
    <Card className="flex items-start gap-3 p-5 shadow-sm hover:shadow-md md:p-6">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-blue-50 text-pulse-accent">
        {icon}
      </div>
      <div className="min-w-0">
        <h4 className="font-semibold text-pulse-navy">{title}</h4>
        <p className="mt-1.5 text-sm leading-relaxed text-pulse-muted">{description}</p>
      </div>
    </Card>
  );
}
