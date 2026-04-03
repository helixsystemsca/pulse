import type {
  ScheduleRoleDefinition,
  ScheduleSettings,
  Shift,
  ShiftTypeConfig,
  Worker,
  Zone,
} from "./types";
import { formatLocalDate } from "./calendar";

export const defaultZones: Zone[] = [
  { id: "z-pano", label: "Pano" },
  { id: "z-pano-s", label: "Pano S" },
  { id: "z-garage", label: "Garage" },
  { id: "z-boiler", label: "Boiler Room" },
];

export const defaultRoles: ScheduleRoleDefinition[] = [
  { id: "worker", label: "Worker" },
  { id: "supervisor", label: "Supervisor" },
  { id: "lead", label: "Lead" },
];

export const defaultShiftTypes: ShiftTypeConfig[] = [
  {
    key: "day",
    label: "Day",
    bg: "bg-emerald-50",
    border: "border-emerald-200/90",
    text: "text-emerald-900",
  },
  {
    key: "afternoon",
    label: "Afternoon",
    bg: "bg-amber-50",
    border: "border-amber-200/90",
    text: "text-amber-950",
  },
  {
    key: "night",
    label: "Night",
    bg: "bg-violet-50",
    border: "border-violet-200/90",
    text: "text-violet-950",
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
  },
  requiredShiftsPerDay: 8,
  activeWorkerTarget: 150,
};

export const defaultWorkers: Worker[] = [
  { id: "w1", name: "Jordan Lee", role: "lead", active: true, certifications: ["OSHA-10", "Forklift"] },
  { id: "w2", name: "Sam Rivera", role: "supervisor", active: true },
  { id: "w3", name: "Alex Chen", role: "worker", active: true, certifications: ["OSHA-10"] },
  { id: "w4", name: "Riley Brooks", role: "worker", active: true },
  { id: "w5", name: "Taylor Morgan", role: "worker", active: true },
  { id: "w6", name: "Casey Ng", role: "supervisor", active: true },
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
        zoneId: "z-pano",
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
          zoneId: "z-garage",
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
      zoneId: "z-pano",
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
      zoneId: "z-pano-s",
      // Demo: Riley has no “Forklift” cert — shows non-blocking red conflict dot in UI.
      required_certifications: offset % 9 === 0 ? ["Forklift"] : undefined,
    });
    shifts.push({
      id: mkId(),
      workerId: offset % 7 === 0 ? null : "w5",
      date: iso,
      startTime: "14:00",
      endTime: "22:00",
      shiftType: "afternoon",
      eventType: "work",
      role: "worker",
      zoneId: "z-garage",
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
        zoneId: "z-boiler",
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
        zoneId: "z-pano",
      });
    }
  }

  return shifts;
}
