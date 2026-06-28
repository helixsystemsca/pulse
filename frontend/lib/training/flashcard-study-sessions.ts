/** Client-only study session history for average session length. */

const KEY = "helix.training.flashcards.sessions";
const MAX_SESSIONS = 200;

export type FlashcardStudySessionRecord = {
  courseId: string;
  sectionId: string;
  startedAt: string;
  endedAt: string;
  cardsReviewed: number;
  durationSeconds: number;
};

function readAll(): FlashcardStudySessionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FlashcardStudySessionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(records: FlashcardStudySessionRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(records.slice(-MAX_SESSIONS)));
  } catch {
    /* quota / private mode */
  }
}

export function recordFlashcardStudySession(record: FlashcardStudySessionRecord): void {
  const records = readAll();
  records.push(record);
  writeAll(records);
}

export function listFlashcardStudySessions(courseId?: string): FlashcardStudySessionRecord[] {
  const records = readAll();
  if (!courseId) return records;
  return records.filter((r) => r.courseId === courseId);
}

export function averageSessionLengthSeconds(courseId?: string): number | null {
  const records = listFlashcardStudySessions(courseId).filter((r) => r.cardsReviewed > 0);
  if (records.length === 0) return null;
  const total = records.reduce((sum, r) => sum + r.durationSeconds, 0);
  return Math.round(total / records.length);
}

export function formatSessionDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}
