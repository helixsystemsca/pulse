/**
 * Planning adapter shape — decoupled from Pulse `TaskRow` / work orders.
 * `start` is informational for imports; CPM uses dependencies + duration.
 */

export type PmTask = {
  id: string;
  name: string;
  /** Anchor date when aligning to a calendar (optional for pure dependency schedules). */
  start: Date;
  duration: number;
  dependencies: string[];
  resource?: string;
  category?: string;
  isCritical?: boolean;
};

export type PmPlanningTab = "gantt" | "network" | "resource" | "critical";

export type PmProjectMeta = {
  id: string;
  name: string;
  code: string;
  projectStart: Date;
};
