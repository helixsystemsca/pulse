import type { StudySessionStats } from "@/lib/training/flashcard-session-stats";
import { STUDY_TYPE_LABELS, type StudyCardType } from "@/lib/training/flashcard-card-types";

type Props = { stats: StudySessionStats };

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flashcard-stat-cell">
      <p className="flashcard-stat-value tabular-nums">{value}</p>
      <p className="flashcard-stat-label">{label}</p>
    </div>
  );
}

function cardTypeLabel(studyType: string): string {
  if (studyType in STUDY_TYPE_LABELS) {
    return STUDY_TYPE_LABELS[studyType as StudyCardType];
  }
  return studyType;
}

export function FlashcardStudyStatsBar({ stats }: Props) {
  return (
    <div className="space-y-2">
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
      {stats.byCardType.length > 1 ? (
        <div className="flashcard-stats-by-type" aria-label="Session accuracy by card type">
          {stats.byCardType.map((row) => (
            <span key={row.studyType} className="flashcard-stats-by-type-pill">
              {cardTypeLabel(row.studyType)}:{" "}
              {row.accuracyPct == null ? "—" : `${row.accuracyPct}%`}
              <span className="font-normal opacity-80"> ({row.reviewsCount})</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
