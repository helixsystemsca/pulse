import { Check } from "lucide-react";

type FeatureItemProps = {
  title: string;
  description: string;
};

export function FeatureItem({ title, description }: FeatureItemProps) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-pulse-accent">
        <Check className="h-4 w-4" strokeWidth={2.5} />
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-pulse-navy">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-pulse-muted">{description}</p>
      </div>
    </li>
  );
}
