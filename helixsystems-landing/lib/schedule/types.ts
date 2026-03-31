/** Duty role id (built-ins: worker | supervisor | lead; settings may add more). */
export type ScheduleDutyRole = string;

/** Shift bucket for color / scheduling. */
export type ShiftTypeKey = "day" | "afternoon" | "night";

export type ShiftEventType = "work" | "training" | "vacation";

export type TimeFormat = "12h" | "24h";

export interface Worker {
  id: string;
  name: string;
  /** Primary job role for this person (used as default in forms). */
  role: ScheduleDutyRole;
  active: boolean;
}

export interface Shift {
  id: string;
  workerId: string | null;
  /** Local calendar date YYYY-MM-DD */
  date: string;
  /** HH:mm 24h */
  startTime: string;
  endTime: string;
  shiftType: ShiftTypeKey;
  /** Work, training block, or PTO-style entry. */
  eventType: ShiftEventType;
  role: ScheduleDutyRole;
  zoneId: string;
}

export interface Zone {
  id: string;
  label: string;
}

export interface ScheduleRoleDefinition {
  id: ScheduleDutyRole;
  label: string;
}

export interface ShiftTypeConfig {
  key: ShiftTypeKey;
  label: string;
  /** Tailwind bg classes (subtle) */
  bg: string;
  border: string;
  text: string;
}

export interface ScheduleSettings {
  workDayStart: string;
  workDayEnd: string;
  shiftDurationPresets: { id: string; label: string; hours: number }[];
  timeFormat: TimeFormat;
  staffing: {
    minWorkersPerShift: number;
    requireSupervisor: boolean;
    maxHoursPerWorkerPerWeek: number;
  };
  /** Approximate slots per day for fill % (mock capacity until headcount API exists). */
  requiredShiftsPerDay: number;
  activeWorkerTarget: number;
}

export interface ScheduleAlerts {
  /** Days in the focused month with at least one shift but no supervisor/lead. */
  daysMissingSupervisor: number;
  /** Shifts with no worker assigned. */
  unassignedShiftCount: number;
  /** Shifts that violate requireSupervisor (worker-only coverage when rule on). */
  openSupervisorSlots: number;
}

export interface WorkforceSummary {
  activeWorkers: number;
  activeTarget: number;
  otRiskLabel: "Low" | "Moderate" | "Elevated";
  fillPercent: number;
  pendingRequests: number;
}
