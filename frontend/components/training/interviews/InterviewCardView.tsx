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
    <section className="space-y-1">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">{title}</h4>
      <ul className="list-disc space-y-0.5 pl-4 text-xs text-ds-foreground">
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
    <section className="space-y-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">STAR breakdown</h4>
      <dl className="grid gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="interview-star-row rounded-md bg-ds-muted/10">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-ds-muted">{row.label}</dt>
            <dd className="mt-0.5 text-ds-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function CardBackSections({ card }: { card: InterviewCard }) {
  return (
    <div className="space-y-3">
      <BulletList items={card.whatTheyAreEvaluating} title="What they're evaluating" />
      <BulletList items={card.answerFramework} title="Answer framework" />
      <StarBlock star={card.star} />
      <BulletList items={card.keywords} title="Keywords" />
      {card.bestStory.trim() ? (
        <section className="space-y-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Best story</h4>
          <p className="text-xs text-ds-foreground">{card.bestStory}</p>
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
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-ds-primary/10 px-2 py-0.5 text-[11px] font-semibold text-ds-primary">
          {card.category}
        </span>
        {difficulty ? (
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", difficultyClass)}>
            {difficulty}
          </span>
        ) : null}
      </div>
      <p className="text-base font-semibold leading-snug text-ds-foreground sm:text-lg">{card.question}</p>
    </>
  );
}

export function InterviewCardView({ card, revealed, mockMode, flipped }: Props) {
  const showAnswer = mockMode ? revealed : flipped;

  return (
    <div className="interview-card-shell">
      <CardFront card={card} />
      {!showAnswer ? (
        <p className="mt-3 text-xs text-ds-muted">
          {mockMode ? "Answer out loud, then reveal when ready." : "Press Space or click Flip to show your answer."}
        </p>
      ) : (
        <div className="mt-4 border-t border-ds-border pt-4">
          <CardBackSections card={card} />
        </div>
      )}
    </div>
  );
}
