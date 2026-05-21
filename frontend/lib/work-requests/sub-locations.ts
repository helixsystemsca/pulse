/** Facility sub-areas for work request intake (year-end analytics). */
export const WORK_REQUEST_SUB_LOCATIONS = [
  "Arena",
  "Pool",
  "Weightroom",
  "Fitness Studio",
  "Racquet",
  "Grounds",
  "Admin",
] as const;

export type WorkRequestSubLocation = (typeof WORK_REQUEST_SUB_LOCATIONS)[number];
