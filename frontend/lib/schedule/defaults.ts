import type {
  ScheduleRoleDefinition,
  ScheduleSettings,
  Shift,
  ShiftTypeConfig,
  Worker,
  Zone,
} from "./types";
import { formatLocalDate } from "./calendar";

/** Demo / offline schedule locations (not equipment “zones” — use org Settings → Schedule → Facilities in production). */
export const defaultZones: Zone[] = [
  { id: "demo-fac-0", label: "Facility 1" },
  { id: "demo-fac-1", label: "Facility 2" },
  { id: "demo-fac-2", label: "Facility 3" },
];

export const defaultRoles: ScheduleRoleDefinition[] = [
  { id: "worker", label: "Operations" },
  { id: "supervisor", label: "Supervisor" },
  { id: "lead", label: "Lead" },
];

export const defaultShiftTypes: ShiftTypeConfig[] = [
  {
    key: "day",
    label: "Day",
    bg: "bg-[color-mix(in_srgb,var(--ds-success)_14%,var(--ds-surface-primary))]",
    border: "border-ds-border",
    text: "text-ds-foreground",
  },
  {
    key: "afternoon",
    label: "Afternoon",
    bg: "bg-[color-mix(in_srgb,#f59e0b_12%,var(--ds-surface-primary))]",
    border: "border-ds-border",
    text: "text-ds-foreground",
  },
  {
    key: "night",
    label: "Night",
    bg: "bg-[color-mix(in_srgb,#a78bfa_11%,var(--ds-surface-primary))]",
    border: "border-ds-border",
    text: "text-ds-foreground",
  },
];

export const defaultSettings: ScheduleSettings = {
  workDayStart: "06:00",
  workDayEnd: "22:00",
  shiftDurationPresets: [
    { id: "p8", label: "8h", hours: 8 },
    { id: "p10", label: "10h", hours: 10 },
    { id: "p12", label: "12h", hours: 12 },
  ],
  timeFormat: "12h",
  staffing: {
    minWorkersPerShift: 2,
    requireSupervisor: true,
    maxHoursPerWorkerPerWeek: 48,
    otRiskMonitoringEnabled: false,
  },
  requiredShiftsPerDay: 8,
  activeWorkerTarget: 150,
};

export const defaultWorkers: Worker[] = [
  {
    id: "w1",
    name: "Jordan Lee",
    role: "lead",
    active: true,
    employmentType: "full_time",
    certifications: ["OSHA-10", "Forklift", "RO", "FA"],
    availability: {
      monday: { available: true, start: "06:00", end: "18:00" },
      tuesday: { available: true, start: "06:00", end: "18:00" },
      wednesday: { available: true, start: "06:00", end: "18:00" },
      thursday: { available: true, start: "06:00", end: "18:00" },
      friday: { available: true, start: "06:00", end: "18:00" },
    },
    recurringShifts: [
      { dayOfWeek: "monday", start: "08:00", end: "16:00", role: "lead", requiredCertifications: ["Forklift"] },
      { dayOfWeek: "wednesday", start: "08:00", end: "16:00", role: "lead" },
      { dayOfWeek: "friday", start: "08:00", end: "16:00", role: "lead" },
    ],
  },
  {
    id: "w2",
    name: "Sam Rivera",
    role: "supervisor",
    active: true,
    employmentType: "full_time",
    certifications: ["FA", "P2"],
    recurringShifts: [
      { dayOfWeek: "tuesday", start: "14:00", end: "22:00" },
      { dayOfWeek: "thursday", start: "14:00", end: "22:00" },
    ],
  },
  {
    id: "w3",
    name: "Alex Chen",
    role: "worker",
    active: true,
    employmentType: "regular_part_time",
    certifications: ["OSHA-10", "FA"],
    recurringShifts: [{ dayOfWeek: "saturday", start: "08:00", end: "16:00" }],
  },
  {
    id: "w4",
    name: "Riley Brooks",
    role: "worker",
    active: true,
    employmentType: "part_time",
    certifications: ["OSHA-10"],
  },
  {
    id: "w5",
    name: "Taylor Morgan",
    role: "worker",
    active: true,
    employmentType: "part_time",
    certifications: ["P1", "FA"],
    recurringShifts: [{ dayOfWeek: "monday", start: "10:00", end: "14:00", requiredCertifications: ["P1"] }],
  },
  {
    id: "w6",
    name: "Casey Ng",
    role: "supervisor",
    active: true,
    employmentType: "regular_part_time",
    certifications: ["FA"],
  },
];

function addDays(base: Date, delta: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return d;
}

/** Seed shifts around “today” for a believable calendar. */
export function buildSeedShifts(now = new Date()): Shift[] {
  const shifts: Shift[] = [];
  let id = 0;
  const mkId = () => `sh-${++id}`;

  for (let offset = -3; offset <= 18; offset++) {
    const d = addDays(now, offset);
    const iso = formatLocalDate(d);
    const dow = d.getDay();

    if (dow === 0 || dow === 6) {
      shifts.push({
        id: mkId(),
        workerId: "w3",
        date: iso,
        startTime: "08:00",
        endTime: "16:00",
        shiftType: "day",
        eventType: "work",
        role: "worker",
        zoneId: "demo-fac-0",
      });
      if (offset % 2 === 0) {
        shifts.push({
          id: mkId(),
          workerId: "w2",
          date: iso,
          startTime: "14:00",
          endTime: "22:00",
          shiftType: "afternoon",
          eventType: "work",
          role: "supervisor",
          zoneId: "demo-fac-1",
        });
      }
      continue;
    }

    shifts.push({
      id: mkId(),
      workerId: offset % 5 === 0 ? null : "w1",
      date: iso,
      startTime: "06:00",
      endTime: "14:00",
      shiftType: "day",
      eventType: "work",
      role: offset % 5 === 0 ? "supervisor" : "lead",
      zoneId: "demo-fac-0",
    });
    shifts.push({
      id: mkId(),
      workerId: "w4",
      date: iso,
      startTime: "06:00",
      endTime: "14:00",
      shiftType: "day",
      eventType: "work",
      role: "worker",
      zoneId: "demo-fac-1",
      // Demo: Riley has no Forklift cert on these days — strict requirement conflict.
      required_certifications: offset % 9 === 0 ? ["Forklift"] : undefined,
    });
    if (offset % 6 === 0) {
      shifts.push({
        id: mkId(),
        workerId: "w4",
        date: iso,
        startTime: "10:00",
        endTime: "18:00",
        shiftType: "day",
        eventType: "work",
        role: "worker",
        zoneId: "demo-fac-2",
        required_certifications: ["P1", "P2"],
        accepts_any_certification: true,
      });
    }
    if (offset % 11 === 0) {
      shifts.push({
        id: mkId(),
        workerId: "w3",
        date: iso,
        startTime: "05:00",
        endTime: "13:00",
        shiftType: "day",
        eventType: "work",
        role: "worker",
        zoneId: "demo-fac-2",
        required_certifications: ["RO"],
      });
    }
    shifts.push({
      id: mkId(),
      workerId: offset % 7 === 0 ? null : "w5",
      date: iso,
      startTime: "14:00",
      endTime: "22:00",
      shiftType: "afternoon",
      eventType: "work",
      role: "worker",
      zoneId: "demo-fac-1",
    });

    if (offset % 4 === 0) {
      shifts.push({
        id: mkId(),
        workerId: "w6",
        date: iso,
        startTime: "22:00",
        endTime: "06:00",
        shiftType: "night",
        eventType: "work",
        role: "supervisor",
        zoneId: "demo-fac-2",
      });
    } else if (offset % 5 === 0) {
      shifts.push({
        id: mkId(),
        workerId: null,
        date: iso,
        startTime: "22:00",
        endTime: "06:00",
        shiftType: "night",
        eventType: "work",
        role: "supervisor",
        zoneId: "demo-fac-0",
      });
    }
  }

  return shifts;
}
