"use client";

import type { InterviewCard } from "@/lib/training/interviews/types";
import { cn } from "@/lib/cn";

type Props = {
  card: InterviewCard;
  revealed: boolean;
  mockMode: boolean;
  flipped: boolean;
};

function BulletList({ items, title }: { items: string[]; title: string }) {
  if (!items.length) return null;
  return (
    <section className="space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ds-muted">{title}</h4>
      <ul className="list-disc space-y-1 pl-4 text-sm text-ds-foreground">
        {items.map((item, i) => (
          <li key={`${title}-${i}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function StarBlock({ star }: { star: InterviewCard["star"] }) {
  const rows: { label: string; value: string }[] = [
    { label: "Situation", value: star.situation },
    { label: "Task", value: star.task },
    { label: "Action", value: star.action },
    { label: "Result", value: star.result },
  ].filter((r) => r.value.trim());

  if (!rows.length) return null;

  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ds-muted">STAR breakdown</h4>
      <dl className="grid gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg bg-ds-muted/10 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">{row.label}</dt>
            <dd className="mt-0.5 text-ds-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function CardBackSections({ card }: { card: InterviewCard }) {
  return (
    <div className="space-y-5">
      <BulletList items={card.whatTheyAreEvaluating} title="What they're evaluating" />
      <BulletList items={card.answerFramework} title="Answer framework" />
      <StarBlock star={card.star} />
      <BulletList items={card.keywords} title="Keywords" />
      {card.bestStory.trim() ? (
        <section className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Best story</h4>
          <p className="text-sm text-ds-foreground">{card.bestStory}</p>
        </section>
      ) : null}
      <BulletList items={card.watchFor} title="Things to avoid" />
      <BulletList items={card.panelNotes.whatGoodSoundsLike} title="Panel notes — what good sounds like" />
      <BulletList items={card.panelNotes.scoreFocus} title="Panel notes — score focus" />
    </div>
  );
}

function CardFront({ card }: { card: InterviewCard }) {
  const difficulty = card.difficulty.trim();
  const difficultyClass =
    difficulty.toLowerCase() === "hard"
      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
      : difficulty.toLowerCase() === "easy"
        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        : difficulty
          ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
          : "";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-ds-primary/10 px-2.5 py-0.5 text-xs font-semibold text-ds-primary">
          {card.category}
        </span>
        {difficulty ? (
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", difficultyClass)}>
            {difficulty}
          </span>
        ) : null}
      </div>
      <p className="text-lg font-semibold leading-snug text-ds-foreground sm:text-xl">{card.question}</p>
    </>
  );
}

export function InterviewCardView({ card, revealed, mockMode, flipped }: Props) {
  if (mockMode) {
    return (
      <div className="rounded-xl border border-ds-border bg-ds-card p-4 shadow-sm sm:p-6">
        <CardFront card={card} />
        {!revealed ? (
          <p className="mt-6 text-sm text-ds-muted">Answer out loud, then reveal when ready.</p>
        ) : (
          <div className="mt-8 border-t border-ds-border pt-6">
            <CardBackSections card={card} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="interview-scene w-full">
      <div className={cn("interview-inner", flipped && "is-flipped")}>
        <div className="interview-face">
          <CardFront card={card} />
          <p className="mt-6 text-xs text-ds-muted">Press Space or click the card to flip.</p>
        </div>
        <div className="interview-face interview-face-back">
          <CardBackSections card={card} />
        </div>
      </div>
    </div>
  );
}
