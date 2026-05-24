import type { WorkforcePlaceholderCard } from "@/lib/team-management/mock-data";
import { cn } from "@/lib/cn";

export function WorkforcePlaceholderCardView({
  card,
  className,
}: {
  card: WorkforcePlaceholderCard;
  className?: string;
}) {
  return (
    <article className={cn("ops-dash-inner-card flex flex-col p-4", className)}>
      <h3 className="text-sm font-bold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">{card.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
        {card.description}
      </p>
      {card.items?.length ? (
        <ul className="mt-3 space-y-1.5 border-t border-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] pt-3">
          {card.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_78%,transparent)]"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--ds-accent)]" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
