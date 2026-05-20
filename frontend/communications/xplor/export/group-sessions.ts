import type { PublicationEntry, PublicationSession, SessionAgeGroup } from "../schema/publication";

function ageSortKey(age: string): string {
  const m = age.match(/(\d+)/);
  return m ? m[1]!.padStart(3, "0") : age;
}

/** Group sessions by age for coordinator brochure export order. */
export function groupSessionsByAge(entry: PublicationEntry): SessionAgeGroup[] {
  const groups = new Map<string, PublicationSession[]>();

  for (const session of entry.sessions) {
    const key = session.ageGroup.trim() || entry.ageRange.trim() || "General";
    const list = groups.get(key) ?? [];
    list.push(session);
    groups.set(key, list);
  }

  if (groups.size === 0 && entry.ageRange) {
    groups.set(entry.ageRange, []);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => ageSortKey(a).localeCompare(ageSortKey(b)))
    .map(([ageGroup, sessions]) => ({
      ageGroup,
      sessions: sessions.map((s, i) => ({
        ...s,
        sessionLabel: s.sessionLabel || `Session ${String.fromCharCode(65 + (i % 26))}`,
      })),
    }));
}

export function attachSessionGroups(entries: PublicationEntry[]): PublicationEntry[] {
  return entries.map((e) => ({
    ...e,
    sessionGroups: groupSessionsByAge(e),
  }));
}
