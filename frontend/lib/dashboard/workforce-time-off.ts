/** One worker time-off span shown on the operations workforce tile (demo until schedule feed). */
export type WorkforceTimeOffEntry = {
  id: string;
  displayName: string;
  initials: string;
  avatar_url?: string | null;
  /** Human-readable range(s), e.g. "May 6th – 9th, May 15th – 16th". */
  dateLabel: string;
};

/** Demo month view — replace with schedule-derived time off when API is wired. */
export const WORKFORCE_TIME_OFF_DEMO: WorkforceTimeOffEntry[] = [
  { id: "to-nick", displayName: "Nick Johnson", initials: "NJ", dateLabel: "May 1st" },
  {
    id: "to-russ",
    displayName: "Russ Young",
    initials: "RY",
    dateLabel: "May 6th – 9th, May 15th – 16th",
  },
  { id: "to-deb", displayName: "Deb Halladay", initials: "DH", dateLabel: "May 15th – 19th" },
  { id: "to-daniel", displayName: "Daniel Dupree", initials: "DD", dateLabel: "May 17th – 18th" },
  { id: "to-steve", displayName: "Steve Archambault", initials: "SA", dateLabel: "May 17th – 18th" },
];
