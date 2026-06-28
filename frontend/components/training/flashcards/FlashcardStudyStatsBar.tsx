import type { StudySessionStats } from "@/lib/training/flashcard-session-stats";

type Props = { stats: StudySessionStats };

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flashcard-stat-cell">
      <p className="flashcard-stat-value tabular-nums">{value}</p>
      <p className="flashcard-stat-label">{label}</p>
    </div>
  );
}

export function FlashcardStudyStatsBar({ stats }: Props) {
  return (
    <div
      className="flashcard-stats-bar"
      aria-label="Study session statistics"
    >
      <StatCell label="Remaining" value={stats.cardsRemaining} />
      <StatCell label="Mastered" value={stats.mastered} />
      <StatCell label="Review due" value={stats.reviewDue} />
      <StatCell label="Streak" value={stats.currentStreak} />
      <StatCell
        label="Accuracy"
        value={stats.sessionAccuracy == null ? "—" : `${stats.sessionAccuracy}%`}
      />
    </div>
  );
}
