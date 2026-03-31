"use client";

import {
  AlertTriangle,
  Ban,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Inbox,
  MapPin,
  Palmtree,
  Plus,
  User,
  Users,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { FeatureItem } from "./FeatureItem";
import { SectionWrapper } from "./SectionWrapper";

type ShiftCode = "D" | "A" | "N" | "TR" | "VAC";

type ShiftBlock = {
  code: ShiftCode;
  short: string;
  fullName: string;
  role: "Worker" | "Lead" | "Supervisor";
  roleTag?: "L" | "S";
  ticketed?: boolean;
  zone: string;
  time: string;
  notes?: string;
  workerId?: string;
  /** Soft scheduling warnings (availability, overlap, cert, hours) */
  schedulingConflict?: "unavailable" | "overlap" | "cert" | "hours";
  schedulingWarningNote?: string;
  /** Coverage gap hints (shift-level) */
  needSupervisor?: boolean;
  needTicketed?: boolean;
};

type DayMeta = {
  day: number;
  inMonth: boolean;
  isToday?: boolean;
  availabilityNote?: string;
  /** Day-level staffing badges */
  staffing?: "understaffed" | "full" | "no_supervisor";
  staffingDetail?: string;
  shifts: ShiftBlock[];
  leaveIcons?: ("vacation" | "training")[];
  pendingRequests?: number;
  /** True when shifts need work (gaps, coverage, or unscheduled) */
  scheduleIncomplete?: boolean;
};

type AvailabilityDay = "available" | "unavailable" | "limited";

type TeamMemberProfile = {
  id: string;
  name: string;
  initials: string;
  role: "Worker" | "Lead" | "Supervisor";
  ticketed: boolean;
  zone: string;
  status: "on-site" | "off-site" | "unavailable";
  managerNotes: string[];
  /** Mon → Sun */
  weekly: [AvailabilityDay, AvailabilityDay, AvailabilityDay, AvailabilityDay, AvailabilityDay, AvailabilityDay, AvailabilityDay];
  exceptions: string[];
};

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const TEAM_MEMBERS: TeamMemberProfile[] = [
  {
    id: "marcus",
    name: "Marcus Jameson",
    initials: "MJ",
    role: "Lead",
    ticketed: true,
    zone: "Zone 1 · Team A",
    status: "on-site",
    managerNotes: ["Prefers day shift", "Back-to-back nights need 12h rest"],
    weekly: ["available", "available", "available", "available", "available", "limited", "limited"],
    exceptions: [],
  },
  {
    id: "elena",
    name: "Elena Rivera",
    initials: "ER",
    role: "Supervisor",
    ticketed: true,
    zone: "Zone 3",
    status: "on-site",
    managerNotes: ["Only certified for Zone 3 elevated work"],
    weekly: ["available", "available", "available", "available", "available", "available", "unavailable"],
    exceptions: ["Vacation Sep 20–22 (planned)"],
  },
  {
    id: "james",
    name: "James Morrison",
    initials: "JM",
    role: "Worker",
    ticketed: true,
    zone: "Garage",
    status: "off-site",
    managerNotes: ["Training Thursdays — prefer PM shifts"],
    weekly: ["available", "available", "available", "limited", "available", "available", "available"],
    exceptions: ["Vendor training: Oct 2"],
  },
  {
    id: "chen",
    name: "Chen Wei",
    initials: "CW",
    role: "Worker",
    ticketed: true,
    zone: "Zone 1",
    status: "unavailable",
    managerNotes: ["PTO blocks must be honored for accreditation audit"],
    weekly: ["available", "available", "available", "available", "available", "unavailable", "unavailable"],
    exceptions: ["PTO Sep 4–6", "Night shift only with ticketed partner"],
  },
  {
    id: "sarah",
    name: "Sarah Williams",
    initials: "SW",
    role: "Supervisor",
    ticketed: false,
    zone: "North district",
    status: "on-site",
    managerNotes: ["Cert renewal scheduled Nov"],
    weekly: ["available", "available", "available", "available", "available", "available", "available"],
    exceptions: [],
  },
  {
    id: "tariq",
    name: "Tariq Khan",
    initials: "TK",
    role: "Worker",
    ticketed: true,
    zone: "Garage",
    status: "on-site",
    managerNotes: [],
    weekly: ["limited", "available", "available", "available", "available", "available", "available"],
    exceptions: [],
  },
  {
    id: "robert",
    name: "Robert Kim",
    initials: "RK",
    role: "Worker",
    ticketed: false,
    zone: "Zone 3",
    status: "on-site",
    managerNotes: ["Needs ticketed co-lead for confined space"],
    weekly: ["available", "available", "available", "available", "available", "available", "available"],
    exceptions: [],
  },
];

function memberById(id: string | undefined): TeamMemberProfile | undefined {
  if (!id) return undefined;
  return TEAM_MEMBERS.find((m) => m.id === id);
}

function memberByFullName(fullName: string): TeamMemberProfile | undefined {
  return TEAM_MEMBERS.find((m) => m.name === fullName);
}

function profileForShift(s: ShiftBlock): TeamMemberProfile | undefined {
  if (s.workerId) return memberById(s.workerId);
  return memberByFullName(s.fullName);
}

function availabilitySummary(m: TeamMemberProfile): string {
  const lim = m.weekly.filter((x) => x === "limited").length;
  const un = m.weekly.filter((x) => x === "unavailable").length;
  return `${7 - un} days available${lim ? ` · ${lim} limited` : ""}${un ? ` · ${un} blocked` : ""}`;
}

function enrichCalendarMeta(days: DayMeta[]): DayMeta[] {
  return days.map((meta) => {
    const shifts = meta.shifts.map((s) => {
      const m = memberByFullName(s.fullName);
      const workerId = s.workerId ?? m?.id;
      let schedulingConflict = s.schedulingConflict;
      let schedulingWarningNote = s.schedulingWarningNote;
      if (workerId === "chen" && meta.leaveIcons?.includes("vacation")) {
        schedulingConflict = "unavailable";
        schedulingWarningNote = "Chen Wei is unavailable (PTO) — confirm override";
      }
      return { ...s, workerId, schedulingConflict, schedulingWarningNote };
    });
    const hasConflict = shifts.some((s) => s.schedulingConflict);
    const scheduleIncomplete =
      meta.inMonth &&
      (shifts.length === 0 ||
        meta.staffing === "understaffed" ||
        meta.staffing === "no_supervisor" ||
        hasConflict);
    return { ...meta, shifts, scheduleIncomplete };
  });
}

/** Next month schedule completion (mock metrics for October vs current September view) */
const NEXT_MONTH_SCHEDULE = {
  label: "October 2024",
  unscheduledDays: 12,
  daysMissingSupervisor: 3,
  detail: "Includes weekends and days with no day supervisor assigned.",
} as const;

const MONTH_LABEL = "September 2024";
const SUBTITLE = "Plant Operations Schedule · North District";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Subtle left accent for shift type — rest stays neutral */
function shiftAccentBorder(code: ShiftCode): string {
  switch (code) {
    case "D":
      return "border-l-emerald-500";
    case "A":
      return "border-l-amber-500";
    case "N":
      return "border-l-violet-500";
    case "TR":
      return "border-l-sky-500";
    case "VAC":
      return "border-l-slate-400";
    default:
      return "border-l-slate-300";
  }
}

function zoneShort(zone: string): string {
  const z = zone.trim().toLowerCase();
  if (z === "gg" || z === "pano") return zone.trim();
  if (z.includes("garage")) return "GAR";
  if (z.includes("zone 1") && z.includes("zone 3")) return "Z1+3";
  if (z.includes("zone 1")) return "Z1";
  if (z.includes("zone 3")) return "Z3";
  if (z.includes("zone 2")) return "Z2";
  return zone.length > 6 ? `${zone.slice(0, 5)}…` : zone;
}

/** Demo roster for first 3 days: D×(2 workers + supervisor), A×(2 workers + lead), N×(3 workers + lead). One day worker on GG; rest Pano. */
function demoThreeShiftBundle(): ShiftBlock[] {
  return [
    {
      code: "D",
      short: "Elena R.",
      fullName: "Elena Rivera",
      workerId: "elena",
      role: "Worker",
      zone: "GG",
      time: "06:00–14:00",
    },
    {
      code: "D",
      short: "James M.",
      fullName: "James Morrison",
      workerId: "james",
      role: "Worker",
      ticketed: true,
      zone: "Pano",
      time: "06:00–14:00",
    },
    {
      code: "D",
      short: "Marcus J.",
      fullName: "Marcus Jameson",
      workerId: "marcus",
      role: "Supervisor",
      roleTag: "S",
      zone: "Pano",
      time: "06:00–14:00",
    },
    {
      code: "A",
      short: "Chen W.",
      fullName: "Chen Wei",
      workerId: "chen",
      role: "Worker",
      zone: "Pano",
      time: "14:00–22:00",
    },
    {
      code: "A",
      short: "Tariq K.",
      fullName: "Tariq Khan",
      workerId: "tariq",
      role: "Worker",
      zone: "Pano",
      time: "14:00–22:00",
    },
    {
      code: "A",
      short: "Sarah W.",
      fullName: "Sarah Williams",
      workerId: "sarah",
      role: "Lead",
      roleTag: "L",
      zone: "Pano",
      time: "14:00–22:00",
    },
    {
      code: "N",
      short: "Robert K.",
      fullName: "Robert Kim",
      workerId: "robert",
      role: "Worker",
      zone: "Pano",
      time: "22:00–06:00",
    },
    { code: "N", short: "Priya N.", fullName: "Priya Nair", role: "Worker", zone: "Pano", time: "22:00–06:00" },
    { code: "N", short: "Aisha T.", fullName: "Aisha Thomas", role: "Worker", zone: "Pano", time: "22:00–06:00" },
    {
      code: "N",
      short: "Diego F.",
      fullName: "Diego Fernandez",
      role: "Lead",
      roleTag: "L",
      zone: "Pano",
      time: "22:00–06:00",
    },
  ];
}

/** Static September 2024 grid: Sep 1 = Sunday */
const SEPTEMBER_2024: DayMeta[] = enrichCalendarMeta((() => {
  const days: DayMeta[] = [];
  const push = (d: DayMeta) => days.push(d);
  // Leading: none (Sep 1 is Sunday)
  for (let day = 1; day <= 30; day += 1) {
    if (day <= 3) {
      push({
        day,
        inMonth: true,
        isToday: day === 2,
        shifts: demoThreeShiftBundle(),
        staffing: "full",
        staffingDetail: "Fully staffed",
      });
    } else if (day === 4) {
      push({
        day: 4,
        inMonth: true,
        leaveIcons: ["vacation"],
        shifts: [
          {
            code: "D",
            short: "Chen W.",
            fullName: "Chen Wei",
            role: "Worker",
            ticketed: true,
            zone: "Zone 1",
            time: "06:00–14:00",
          },
        ],
        availabilityNote: "1 unavailable",
      });
    } else if (day === 5) {
      push({
        day: 5,
        inMonth: true,
        leaveIcons: ["training"],
        shifts: [],
        availabilityNote: "Training day",
      });
    } else if (day === 6) {
      push({
        day: 6,
        inMonth: true,
        shifts: [
          {
            code: "D",
            short: "Marcus J.",
            fullName: "Marcus Jameson",
            role: "Lead",
            roleTag: "L",
            zone: "Zone 1",
            time: "06:00–14:00",
          },
          {
            code: "A",
            short: "Tariq K.",
            fullName: "Tariq Khan",
            role: "Worker",
            ticketed: true,
            zone: "Garage",
            time: "14:00–22:00",
          },
        ],
        staffing: "understaffed",
        staffingDetail: "Afternoon short 1",
      });
    } else if (day === 7) {
      push({
        day: 7,
        inMonth: true,
        shifts: [
          {
            code: "D",
            short: "Marcus J.",
            fullName: "Marcus Jameson",
            role: "Lead",
            roleTag: "L",
            ticketed: true,
            zone: "Zone 1",
            time: "06:00–14:00",
            notes: "In progress — handoff at 14:00.",
          },
          {
            code: "D",
            short: "Elena R.",
            fullName: "Elena Rivera",
            role: "Worker",
            zone: "Zone 3",
            time: "06:00–14:00",
          },
          {
            code: "D",
            short: "Ken P.",
            fullName: "Ken Park",
            role: "Worker",
            ticketed: true,
            zone: "Zone 1",
            time: "06:00–14:00",
          },
          {
            code: "D",
            short: "Aisha T.",
            fullName: "Aisha Thomas",
            role: "Worker",
            zone: "Garage",
            time: "06:00–14:00",
          },
          {
            code: "A",
            short: "Sarah W.",
            fullName: "Sarah Williams",
            role: "Supervisor",
            roleTag: "S",
            zone: "Garage",
            time: "14:00–22:00",
          },
          {
            code: "A",
            short: "Omar H.",
            fullName: "Omar Hassan",
            role: "Worker",
            zone: "Zone 3",
            time: "14:00–22:00",
          },
          {
            code: "A",
            short: "Luis G.",
            fullName: "Luis Gutierrez",
            role: "Worker",
            ticketed: true,
            zone: "Zone 1",
            time: "14:00–22:00",
          },
          {
            code: "N",
            short: "Chen W.",
            fullName: "Chen Wei",
            role: "Worker",
            ticketed: true,
            zone: "Zone 1",
            time: "22:00–06:00",
          },
          {
            code: "N",
            short: "Priya N.",
            fullName: "Priya Nair",
            role: "Worker",
            zone: "Zone 3",
            time: "22:00–06:00",
          },
          {
            code: "N",
            short: "Diego F.",
            fullName: "Diego Fernandez",
            role: "Lead",
            roleTag: "L",
            zone: "Garage",
            time: "22:00–06:00",
          },
        ],
        staffing: "full",
        staffingDetail: "Fully staffed",
      });
    } else if (day <= 14) {
      push({
        day,
        inMonth: true,
        shifts:
          day % 4 === 0
            ? [
                {
                  code: "D",
                  short: "Team A",
                  fullName: "Day crew A",
                  role: "Worker",
                  zone: "Zone 1 / Zone 3",
                  time: "06:00–14:00",
                },
              ]
            : [],
        staffing: day % 5 === 0 ? "understaffed" : undefined,
        staffingDetail: day % 5 === 0 ? "Coverage gap" : undefined,
      });
    } else {
      push({ day, inMonth: true, shifts: [] });
    }
  }
  // Trailing next month (Oct 1–5) for 5-row alignment
  for (let day = 1; day <= 5; day += 1) {
    push({ day, inMonth: false, shifts: [] });
  }
  return days;
})());

/** Sun–Tue with full demo shifts (days 1–3). */
const SCHEDULE_VIEW_DAYS = SEPTEMBER_2024.filter((m) => m.inMonth && m.day >= 1 && m.day <= 3).sort(
  (a, b) => a.day - b.day,
);
const SCHEDULE_VIEW_WEEKDAYS = WEEKDAYS.slice(0, 3);

function ScheduleLegend({ variant }: { variant: "sidebar" | "strip" }) {
  const shifts = [
    { label: "Day", bar: "bg-emerald-500" },
    { label: "Aft", bar: "bg-amber-500" },
    { label: "Night", bar: "bg-violet-500" },
  ] as const;

  if (variant === "strip") {
    return (
      <div
        className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm sm:gap-x-3"
        aria-label="Schedule legend"
      >
        <span className="text-[7px] font-bold uppercase tracking-wide text-pulse-muted sm:text-[8px]">Key</span>
        {shifts.map((x) => (
          <span key={x.label} className="inline-flex items-center gap-1 text-[7px] font-semibold text-pulse-navy sm:text-[8px]">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${x.bar}`} aria-hidden />
            {x.label}
          </span>
        ))}
        <span className="hidden h-3 w-px bg-slate-200 sm:block" aria-hidden />
        <span className="inline-flex items-center gap-0.5 text-[7px] text-pulse-muted sm:text-[8px]">
          <BookOpen className="h-2 w-2 shrink-0" strokeWidth={2} aria-hidden />
          Train
        </span>
        <span className="inline-flex items-center gap-0.5 text-[7px] text-pulse-muted sm:text-[8px]">
          <Palmtree className="h-2 w-2 shrink-0" strokeWidth={2} aria-hidden />
          PTO
        </span>
        <span className="inline-flex items-center gap-0.5 text-[7px] text-pulse-muted sm:text-[8px]">
          <User className="h-2 w-2 shrink-0" strokeWidth={2} aria-hidden />
          <span className="font-mono font-bold text-pulse-navy">L</span>
          <span className="font-mono font-bold text-pulse-navy">S</span>
        </span>
        <span className="text-[7px] font-semibold text-emerald-800 sm:text-[8px]">✔ tick</span>
        <span className="text-[6px] text-pulse-muted sm:text-[7px]">GG/Pano</span>
        <span className="text-[6px] text-amber-800/90 sm:text-[7px]">Tint=incomplete</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 rounded-md border border-slate-200 bg-white px-1 py-1.5 md:px-1.5 md:py-2">
      <p className="text-center text-[7px] font-bold uppercase tracking-wide text-pulse-muted md:text-[8px]">
        Key
      </p>
      <ul className="flex flex-col gap-1 text-[7px] leading-tight text-pulse-navy md:text-[8px]">
        {shifts.map((x) => (
          <li key={x.label} className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${x.bar}`} aria-hidden />
            <span className="font-semibold">{x.label}</span>
          </li>
        ))}
        <li className="flex items-center gap-0.5 text-pulse-muted">
          <BookOpen className="h-2 w-2 shrink-0" strokeWidth={2} aria-hidden />
          Train
        </li>
        <li className="flex items-center gap-0.5 text-pulse-muted">
          <Palmtree className="h-2 w-2 shrink-0" strokeWidth={2} aria-hidden />
          PTO
        </li>
        <li className="border-t border-slate-100 pt-1 text-pulse-muted">
          <User className="mb-0.5 inline h-2 w-2" strokeWidth={2} aria-hidden />{" "}
          <span className="font-mono font-bold text-pulse-navy">L</span>{" "}
          <span className="font-mono font-bold text-pulse-navy">S</span>
        </li>
        <li className="text-emerald-700">✔ tick</li>
        <li className="text-[6px] text-pulse-muted md:text-[7px]">GG / Pano</li>
        <li className="text-[6px] text-amber-800/90 md:text-[7px]">Tint = incomplete</li>
      </ul>
    </div>
  );
}

/** Day-level staffing + optional scheduling conflict glyph */
function StaffingGlyph({ meta }: { meta: DayMeta }) {
  const conflict = meta.shifts.some((s) => s.schedulingConflict);
  const staffing = !meta.staffing ? null : meta.staffing === "full" ? (
    <span className="text-emerald-700" title={meta.staffingDetail ?? "Fully staffed"}>
      ✔
    </span>
  ) : meta.staffing === "understaffed" ? (
    <span className="text-amber-600" title={meta.staffingDetail ?? "Understaffed"}>
      ⚠
    </span>
  ) : (
    <span className="font-bold text-red-600" title={meta.staffingDetail ?? "No supervisor"}>
      !
    </span>
  );
  return (
    <span className="flex items-center gap-0.5">
      {staffing}
      {conflict ? (
        <span className="text-amber-700" title="Worker may be unavailable or over limits — review shift">
          ⚠
        </span>
      ) : null}
    </span>
  );
}

function ShiftTag({
  s,
  active,
  onHover,
  onLeave,
  onProfileClick,
}: {
  s: ShiftBlock;
  active?: boolean;
  onHover: (el: HTMLElement | null, shift: ShiftBlock) => void;
  onLeave: () => void;
  onProfileClick?: (shift: ShiftBlock, el: HTMLElement) => void;
}) {
  const accent = shiftAccentBorder(s.code);
  const z = zoneShort(s.zone);
  const tail: string[] = [];
  if (s.ticketed) tail.push("✔");
  if (s.roleTag === "L") tail.push("L");
  if (s.roleTag === "S") tail.push("S");
  const tailStr = tail.join(" ");

  return (
    <div
      role="presentation"
      onMouseEnter={(e) => onHover(e.currentTarget, s)}
      onMouseLeave={onLeave}
      onClick={(e) => {
        e.stopPropagation();
        onProfileClick?.(s, e.currentTarget);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
          onProfileClick?.(s, e.currentTarget as HTMLElement);
        }
      }}
      tabIndex={0}
      className={`flex w-full min-w-0 cursor-pointer flex-col gap-0.5 border-l-2 bg-slate-50 py-0.5 pl-1 pr-0.5 text-pulse-navy antialiased outline-none ring-pulse-accent/30 focus-visible:ring-1 ${accent} ${
        active ? "bg-sky-50" : ""
      } ${s.schedulingConflict ? "ring-1 ring-amber-200/90 ring-inset" : ""}`}
    >
      <div className="flex items-start justify-between gap-1 leading-none">
        <span className="shrink-0 text-[8px] font-bold tabular-nums text-slate-800">{s.code}</span>
        <span className="max-w-[3.75rem] truncate text-right text-[7px] font-semibold capitalize text-slate-500">
          {s.role}
        </span>
      </div>
      <p className="text-[7.5px] font-semibold leading-snug tracking-tight text-pulse-navy [word-break:break-word] sm:text-[8px]">
        {s.fullName}
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-x-1 text-[7px] leading-tight text-slate-600">
        <span className="min-w-0 shrink tabular-nums">{s.time}</span>
        <span className="shrink-0 text-slate-300">·</span>
        <span className="shrink-0 font-bold text-slate-700">{z}</span>
        {tailStr ? <span className="shrink-0 font-semibold text-slate-700">{tailStr}</span> : null}
        {s.needSupervisor ? (
          <span className="shrink-0 font-bold leading-none text-red-600" title="No supervisor coverage">
            !
          </span>
        ) : null}
        {s.needTicketed ? (
          <span className="shrink-0 font-bold leading-none text-amber-600" title="Ticketed worker required">
            ⚠
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ScheduleCompletionBanner({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-1.5 rounded-md border border-amber-200/90 bg-amber-50/90 px-2 py-1 text-[9px] text-amber-950 shadow-sm sm:text-[10px]">
      <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1 leading-snug">
        <p className="font-bold text-amber-950">
          Next month incomplete · {NEXT_MONTH_SCHEDULE.label}
        </p>
        <p className="text-amber-900/85">
          <span className="font-semibold tabular-nums">{NEXT_MONTH_SCHEDULE.unscheduledDays}d</span> open
          {NEXT_MONTH_SCHEDULE.daysMissingSupervisor > 0 ? (
            <>
              {" "}
              · <span className="font-semibold">{NEXT_MONTH_SCHEDULE.daysMissingSupervisor}</span> no sup.
            </>
          ) : null}
        </p>
        <p className="mt-0.5 text-[8px] text-amber-800/80">{NEXT_MONTH_SCHEDULE.detail}</p>
      </div>
      <button
        type="button"
        onClick={onFinish}
        className="shrink-0 rounded border border-amber-300 bg-white px-2 py-0.5 text-[8px] font-bold text-amber-950 shadow-sm hover:bg-amber-100/80 sm:text-[9px]"
      >
        Finish
      </button>
    </div>
  );
}

function PersonnelPanel({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = selectedId ? memberById(selectedId) : undefined;
  const statusStyle = (s: TeamMemberProfile["status"]) => {
    if (s === "on-site") return "bg-emerald-50 text-emerald-900 ring-emerald-100";
    if (s === "off-site") return "bg-slate-100 text-slate-700 ring-slate-200";
    return "bg-amber-50 text-amber-900 ring-amber-100";
  };
  return (
    <div className="flex min-h-[16rem] flex-col gap-2 rounded-lg border border-slate-200 bg-white sm:min-h-[18rem] md:flex-row">
      <div className="max-h-[40vh] min-w-0 flex-1 overflow-y-auto border-b border-slate-200 p-2 md:max-h-none md:w-[42%] md:border-b-0 md:border-r">
        <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wide text-pulse-muted">Team ({TEAM_MEMBERS.length})</p>
        <ul className="space-y-1">
          {TEAM_MEMBERS.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onSelect(m.id)}
                className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                  selectedId === m.id
                    ? "border-pulse-accent/40 bg-sky-50 ring-1 ring-pulse-accent/25"
                    : "border-slate-100 bg-white hover:border-slate-200"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-pulse-navy">
                  {m.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-pulse-navy">{m.name}</p>
                  <p className="truncate text-[10px] text-pulse-muted">
                    {m.role} · {m.zone}
                  </p>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ring-1 ${statusStyle(m.status)}`}>
                  {m.status.replace("-", " ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 md:min-h-[16rem]">
        {selected ? (
          <div className="space-y-3 text-[11px]">
            <div>
              <p className="text-lg font-bold text-pulse-navy">{selected.name}</p>
              <p className="text-pulse-muted">
                {selected.role}
                {selected.ticketed ? " · Ticketed ✔" : ""}
              </p>
              <p className="mt-1 flex items-center gap-1 text-pulse-muted">
                <MapPin className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                {selected.zone}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-pulse-muted">Manager notes</p>
              {selected.managerNotes.length ? (
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-pulse-muted">
                  {selected.managerNotes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-pulse-muted">No notes on file.</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-pulse-muted">Weekly availability</p>
              <div className="mt-1 grid grid-cols-7 gap-0.5 text-center">
                {WEEK_LABELS.map((d, i) => {
                  const v = selected.weekly[i];
                  const cls =
                    v === "available"
                      ? "bg-emerald-50 text-emerald-900"
                      : v === "limited"
                        ? "bg-amber-50 text-amber-900"
                        : "bg-slate-100 text-slate-500 line-through decoration-slate-400";
                  return (
                    <div key={d} className="min-w-0">
                      <p className="text-[8px] font-bold text-pulse-muted">{d}</p>
                      <p className={`mt-0.5 rounded px-0.5 py-0.5 text-[8px] font-semibold ${cls}`} title={v}>
                        {v === "available" ? "✓" : v === "limited" ? "~" : "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-pulse-muted">Exceptions</p>
              {selected.exceptions.length ? (
                <ul className="mt-1 space-y-0.5 text-pulse-muted">
                  {selected.exceptions.map((ex) => (
                    <li key={ex} className="flex items-start gap-1">
                      <ClipboardList className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
                      {ex}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-pulse-muted">No upcoming exceptions.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-[11px] text-pulse-muted">
            Select a team member to view profile and availability.
          </p>
        )}
      </div>
    </div>
  );
}

function QuickEditPanel({
  open,
  dayLabel,
  scheduleWarning,
  onClose,
}: {
  open: boolean;
  dayLabel: string;
  scheduleWarning?: string | null;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="absolute inset-0 z-30 flex items-end justify-end sm:items-stretch"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-shift-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-pulse-navy/20 backdrop-blur-[2px]"
        aria-label="Close panel"
        onClick={onClose}
      />
      <div className="relative z-10 m-2 flex max-h-[min(90%,480px)] w-full max-w-sm flex-col overflow-hidden rounded-lg border border-pulse-border bg-white shadow-lg sm:m-3 sm:max-h-none sm:rounded-l-lg sm:rounded-r-md">
        <div className="flex items-start justify-between gap-2 border-b border-pulse-border bg-slate-50/90 px-4 py-3">
          <div>
            <p id="quick-shift-title" className="text-sm font-bold text-pulse-navy">
              Quick add / edit shift
            </p>
            <p className="mt-0.5 text-xs font-medium text-pulse-muted">{dayLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-pulse-muted transition hover:bg-white hover:text-pulse-navy"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
          {scheduleWarning ? (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50/90 px-2.5 py-2 text-[11px] leading-snug text-amber-950"
              role="status"
            >
              <p className="font-bold text-amber-950">Availability</p>
              <p className="mt-0.5">⚠ {scheduleWarning}</p>
              <button type="button" className="mt-2 text-[10px] font-bold text-pulse-accent underline">
                Override and save anyway
              </button>
            </div>
          ) : null}
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-pulse-muted">Smart checks</p>
            <ul className="mt-1 space-y-1 text-[10px] text-pulse-muted">
              <li className="flex items-center gap-1.5">
                <span className="text-emerald-600">✓</span> No overlapping shift in roster
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-amber-600">⚠</span> Ticketed worker suggested for Zone 1 night
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-emerald-600">✓</span> Hours within rolling 7-day limit
              </li>
            </ul>
          </div>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-pulse-muted">Worker</span>
            <div className="mt-1 rounded-lg border border-pulse-border bg-white px-3 py-2 text-pulse-navy shadow-sm">
              Marcus Jameson
            </div>
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-pulse-muted">Shift</span>
            <div className="mt-1 rounded-lg border border-pulse-border bg-white px-3 py-2 text-pulse-navy shadow-sm">
              Day (06:00–14:00)
            </div>
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-pulse-muted">Zone</span>
            <div className="mt-1 rounded-lg border border-pulse-border bg-white px-3 py-2 text-pulse-navy shadow-sm">
              Zone 1 — North floor
            </div>
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-pulse-muted">Notes</span>
            <div className="mt-1 min-h-[4rem] rounded-lg border border-dashed border-pulse-border bg-slate-50/80 px-3 py-2 text-xs text-pulse-muted">
              Optional handoff notes appear here…
            </div>
          </label>
        </div>
        <div className="flex gap-2 border-t border-pulse-border bg-white px-4 py-3">
          <button
            type="button"
            className="flex-1 rounded-lg border border-pulse-border bg-white py-2 text-xs font-bold text-pulse-navy shadow-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg bg-pulse-accent py-2 text-xs font-bold text-white shadow-md shadow-blue-900/15"
            onClick={onClose}
          >
            Save shift
          </button>
        </div>
      </div>
    </div>
  );
}

function TooltipPortal({
  shift,
  anchorRef,
}: {
  shift: ShiftBlock | null;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el || !shift) {
      setPos(null);
      return;
    }
    const place = () => {
      const r = el.getBoundingClientRect();
      const margin = 8;
      const center = r.left + r.width / 2;
      const left = Math.min(
        window.innerWidth - margin,
        Math.max(margin, center),
      );
      setPos({ top: r.top - 6, left });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [shift, anchorRef]);

  if (!shift || !pos) return null;

  return (
    <div
      className="pointer-events-none fixed z-[100] w-[220px] -translate-x-1/2 -translate-y-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left text-[11px] shadow-md"
      style={{ top: pos.top, left: pos.left }}
      role="tooltip"
    >
      <p className="font-bold text-pulse-navy">{shift.fullName}</p>
      <p className="mt-0.5 leading-snug text-pulse-muted">
        {shift.role}
        {shift.roleTag ? ` · ${shift.roleTag}` : ""}
        {shift.ticketed ? " · Ticketed" : ""}
      </p>
      <p className="mt-1.5 font-semibold text-pulse-navy">{shift.time}</p>
      <p className="text-pulse-muted">{shift.zone}</p>
      {shift.notes ? (
        <p className="mt-1.5 border-t border-slate-100 pt-1.5 leading-snug text-slate-600">{shift.notes}</p>
      ) : null}
    </div>
  );
}

function ProfileMiniPopover({
  shift,
  open,
  anchorRef,
  onClose,
  onViewFullProfile,
}: {
  shift: ShiftBlock | null;
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onViewFullProfile: (memberId: string) => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const member = shift ? profileForShift(shift) : undefined;

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!open || !el || !member) {
      setPos(null);
      return;
    }
    const place = () => {
      const r = el.getBoundingClientRect();
      const w = 260;
      let left = r.left + r.width / 2 - w / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      setPos({ top: r.bottom + 6, left });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, member, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open, onClose, anchorRef]);

  if (!open || !shift || !member || !pos) return null;

  return (
    <div
      className="pointer-events-auto fixed z-[110] w-[260px] rounded-lg border border-slate-200 bg-white p-3 text-[11px] shadow-lg"
      style={{ top: pos.top, left: pos.left }}
      role="dialog"
      aria-label={`Profile ${member.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-pulse-navy">{member.name}</p>
          <p className="text-pulse-muted">
            {member.role}
            {member.ticketed ? " · ✔ Ticketed" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-pulse-muted hover:bg-slate-100"
          aria-label="Close profile"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
      <p className="mt-2 text-pulse-muted">{shift.time} · {shift.zone}</p>
      <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] font-semibold uppercase tracking-wide text-pulse-muted">
        Availability
      </p>
      <p className="mt-0.5 text-pulse-navy">{availabilitySummary(member)}</p>
      {member.managerNotes[0] ? (
        <p className="mt-2 border-t border-slate-100 pt-2 leading-snug text-pulse-muted">
          <span className="font-semibold text-pulse-navy">Note: </span>
          {member.managerNotes[0]}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => {
          onViewFullProfile(member.id);
          onClose();
        }}
        className="mt-3 w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 text-[10px] font-bold text-pulse-navy hover:bg-slate-100"
      >
        Open full profile
      </button>
    </div>
  );
}

function SchedulingCalendarMock() {
  const [navTab, setNavTab] = useState<"calendar" | "personnel">("calendar");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelScheduleWarning, setPanelScheduleWarning] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<{ day: number; inMonth: boolean } | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(TEAM_MEMBERS[0]?.id ?? null);
  const [hovered, setHovered] = useState<ShiftBlock | null>(null);
  const [profileShift, setProfileShift] = useState<ShiftBlock | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const profileAnchorRef = useRef<HTMLElement | null>(null);

  const openPanelForDay = (meta: DayMeta) => {
    if (!meta.inMonth) return;
    setSelectedDay({ day: meta.day, inMonth: meta.inMonth });
    const firstWarn = meta.shifts.find((s) => s.schedulingConflict)?.schedulingWarningNote ?? null;
    setPanelScheduleWarning(firstWarn);
    setPanelOpen(true);
  };

  const scrollToFirstIncomplete = () => {
    setNavTab("calendar");
    const target = SEPTEMBER_2024.find((m) => m.inMonth && m.scheduleIncomplete);
    if (!target) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`ws-day-${target.day}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const dayLabel =
    selectedDay && selectedDay.inMonth
      ? `${MONTH_LABEL.split(" ")[0]} ${selectedDay.day}, ${MONTH_LABEL.split(" ")[1]}`
      : "";

  return (
    <div className="relative w-full">
      <div className="rounded-xl border border-slate-300/90 bg-slate-200/80 p-px shadow-md shadow-slate-900/10">
        <div className="relative flex min-h-[30rem] flex-col overflow-hidden rounded-[11px] bg-slate-50 sm:min-h-[33.5rem] md:min-h-[35rem] lg:min-h-[36rem]">
          <header className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-2.5 py-2 sm:px-3 md:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-pulse-accent text-white">
                <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-xs font-bold tracking-tight text-pulse-navy sm:text-sm">Schedule</h3>
                <p className="truncate text-[10px] text-pulse-muted">{SUBTITLE}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="hidden items-center gap-0.5 text-[10px] font-semibold text-amber-800 sm:inline-flex">
                <Inbox className="h-3 w-3" strokeWidth={2} aria-hidden />
                2 pending
              </span>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-md bg-pulse-accent px-2.5 text-[11px] font-bold text-white"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                Add
              </button>
            </div>
          </header>

          <nav
            className="relative z-10 flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-2 py-1.5 sm:px-3"
            aria-label="Scheduler sections"
          >
            {(
              [
                { id: "calendar" as const, label: "Calendar", Icon: CalendarDays },
                { id: "personnel" as const, label: "Personnel", Icon: User },
                { id: "reports" as const, label: "Reports", Icon: ClipboardList, disabled: true },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={"disabled" in item && item.disabled}
                onClick={() => {
                  if (item.id === "calendar" || item.id === "personnel") setNavTab(item.id);
                }}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${
                  (item.id === "calendar" && navTab === "calendar") || (item.id === "personnel" && navTab === "personnel")
                    ? "bg-slate-100 text-pulse-navy ring-1 ring-slate-200"
                    : "text-pulse-muted hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                }`}
              >
                <item.Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2 sm:p-3 md:flex-row md:gap-2">
            {navTab === "calendar" ? (
              <div className="hidden w-14 shrink-0 self-stretch md:block md:w-[4.5rem]">
                <ScheduleLegend variant="sidebar" />
              </div>
            ) : null}

            <div className="relative min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-2 sm:p-2.5">
              {navTab === "personnel" ? (
                <PersonnelPanel selectedId={selectedPersonId} onSelect={setSelectedPersonId} />
              ) : (
                <>
              {navTab === "calendar" ? (
                <div className="mb-2 md:hidden">
                  <ScheduleLegend variant="strip" />
                </div>
              ) : null}
              <div className="relative min-h-[21rem] overflow-hidden rounded-md sm:min-h-[26.5rem] md:min-h-[28rem] lg:min-h-[30rem]">
                <div className="relative">
                    <ScheduleCompletionBanner onFinish={scrollToFirstIncomplete} />
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold tracking-tight text-pulse-navy sm:text-base">{MONTH_LABEL}</h4>
                          <span className="rounded bg-slate-100 px-1 py-px text-[8px] font-bold uppercase text-slate-600">
                            3 days
                          </span>
                        </div>
                        <p className="text-[9px] text-pulse-muted">
                          Sun–Tue · click a day · click worker for profile · hover shift for detail
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          className="rounded border border-slate-200 bg-white p-1 text-pulse-navy"
                          aria-label="Previous month"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-pulse-navy"
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          className="rounded border border-slate-200 bg-white p-1 text-pulse-navy"
                          aria-label="Next month"
                        >
                          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-px border-b border-slate-100 pb-1">
                      {SCHEDULE_VIEW_WEEKDAYS.map((d) => (
                        <div key={d} className="text-center text-[8px] font-bold uppercase tracking-wide text-pulse-muted">
                          {d}
                        </div>
                      ))}
                    </div>

                    <div className="mt-1 grid grid-cols-3 gap-1.5 sm:gap-2">
                      {SCHEDULE_VIEW_DAYS.map((meta, idx) => {
                  const muted = !meta.inMonth;
                  const today = meta.isToday;
                  return (
                    <div
                      key={`${meta.inMonth ? "m" : "n"}-${meta.day}-${idx}`}
                      id={meta.inMonth ? `ws-day-${meta.day}` : undefined}
                      className={`relative flex min-h-[6.25rem] flex-col rounded-md border px-1.5 pb-1.5 pt-3.5 sm:min-h-[7.25rem] md:min-h-[8rem] lg:min-h-[8.5rem] ${
                        muted
                          ? "border-transparent bg-slate-50/60 text-slate-400"
                          : "border-slate-200 bg-white"
                      } ${
                        today ? "bg-sky-50/40 ring-1 ring-pulse-accent/70" : ""
                      } ${
                        meta.inMonth && meta.scheduleIncomplete && !today ? "bg-amber-50/35" : ""
                      } ${!muted ? "cursor-pointer hover:border-slate-300" : ""}`}
                      onClick={() => openPanelForDay(meta)}
                      onKeyDown={(e) => {
                        if (!meta.inMonth) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openPanelForDay(meta);
                        }
                      }}
                      role={meta.inMonth ? "button" : undefined}
                      tabIndex={meta.inMonth ? 0 : undefined}
                      aria-label={
                        meta.inMonth
                          ? `${MONTH_LABEL.split(" ")[0]} ${meta.day}, open quick shift editor`
                          : undefined
                      }
                    >
                      <span
                        className={`absolute left-1 top-0.5 text-[9px] font-bold tabular-nums leading-none ${
                          muted ? "text-slate-300" : "text-pulse-navy"
                        }`}
                      >
                        {meta.day}
                      </span>
                      {today ? (
                        <span className="absolute right-0.5 top-0.5 rounded px-0.5 py-px text-[6px] font-bold uppercase leading-none text-pulse-accent ring-1 ring-pulse-accent/40">
                          Now
                        </span>
                      ) : null}
                      {meta.inMonth ? (
                        <span
                          className="pointer-events-none absolute right-0.5 top-3.5 flex h-3.5 w-3.5 items-center justify-center rounded border border-slate-200 bg-white text-pulse-navy"
                          aria-hidden
                        >
                          <Plus className="h-2 w-2" strokeWidth={2.5} />
                        </span>
                      ) : null}

                      <div className="mt-0.5 flex min-h-[0.75rem] items-center gap-0.5 text-[8px] leading-none text-pulse-muted">
                        <StaffingGlyph meta={meta} />
                        {meta.pendingRequests ? (
                          <span className="tabular-nums text-slate-500" title="Pending requests">
                            · {meta.pendingRequests} req
                          </span>
                        ) : null}
                      </div>

                      {meta.leaveIcons?.includes("vacation") ? (
                        <span className="mt-0.5 inline-flex items-center gap-0.5 truncate text-[8px] font-medium text-slate-500">
                          <Palmtree className="h-2 w-2 shrink-0" strokeWidth={2} aria-hidden />
                          PTO
                        </span>
                      ) : null}
                      {meta.leaveIcons?.includes("training") ? (
                        <span className="mt-0.5 inline-flex items-center gap-0.5 truncate text-[8px] font-medium text-sky-800">
                          <BookOpen className="h-2 w-2 shrink-0" strokeWidth={2} aria-hidden />
                          Train
                        </span>
                      ) : null}
                      {meta.availabilityNote ? (
                        <span className="mt-0.5 inline-flex items-center gap-0.5 truncate text-[8px] text-amber-800">
                          <Ban className="h-2 w-2 shrink-0" strokeWidth={2} aria-hidden />
                          {meta.availabilityNote}
                        </span>
                      ) : null}

                      <div className="mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5">
                        {meta.shifts.map((s, si) => (
                          <ShiftTag
                            key={`${meta.day}-${si}-${s.short}`}
                            s={s}
                            active={Boolean(today && si < 2)}
                            onHover={(el, shift) => {
                              anchorRef.current = el;
                              setHovered(shift);
                            }}
                            onLeave={() => {
                              anchorRef.current = null;
                              setHovered(null);
                            }}
                            onProfileClick={(s, el) => {
                              if (!profileForShift(s)) return;
                              setHovered(null);
                              anchorRef.current = null;
                              profileAnchorRef.current = el;
                              setProfileShift(s);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-2 sm:grid-cols-4">
                {[
                  { label: "Active", value: "124 / 150", icon: Users },
                  { label: "OT risk", value: "12", icon: AlertTriangle, warn: true },
                  { label: "Fill", value: "98.2%", icon: Check },
                  { label: "Requests", value: "4 new", icon: Inbox, highlight: true },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 ${
                      kpi.highlight
                        ? "border-pulse-accent/40 bg-pulse-accent text-white"
                        : kpi.warn
                          ? "border-amber-200/80 bg-amber-50/70"
                          : "border-slate-200 bg-slate-50/80"
                    }`}
                  >
                    <kpi.icon
                      className={`h-3.5 w-3.5 shrink-0 ${kpi.highlight ? "text-white" : kpi.warn ? "text-amber-700" : "text-pulse-muted"}`}
                      strokeWidth={2}
                      aria-hidden
                    />
                    <div className="min-w-0 leading-tight">
                      <p
                        className={`text-[9px] font-bold uppercase tracking-wide ${kpi.highlight ? "text-white/90" : "text-pulse-muted"}`}
                      >
                        {kpi.label}
                      </p>
                      <p className={`truncate text-xs font-bold ${kpi.highlight ? "text-white" : "text-pulse-navy"}`}>
                        {kpi.value}
                      </p>
                    </div>
                  </div>
                ))}
                    </div>
                </div>
                <div
                  className="pointer-events-none absolute inset-0 rounded-md shadow-[inset_0_0_12px_rgba(255,255,255,0.18)] ring-1 ring-inset ring-slate-200/35"
                  aria-hidden
                />
              </div>

              <QuickEditPanel
                open={panelOpen}
                dayLabel={dayLabel}
                scheduleWarning={panelScheduleWarning}
                onClose={() => {
                  setPanelOpen(false);
                  setPanelScheduleWarning(null);
                }}
              />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <TooltipPortal shift={profileShift ? null : hovered} anchorRef={anchorRef} />
      <ProfileMiniPopover
        shift={profileShift}
        open={Boolean(profileShift)}
        anchorRef={profileAnchorRef}
        onClose={() => {
          setProfileShift(null);
          profileAnchorRef.current = null;
        }}
        onViewFullProfile={(id) => {
          setNavTab("personnel");
          setSelectedPersonId(id);
        }}
      />
    </div>
  );
}

export function WorkforceSchedulingSection() {
  return (
    <SectionWrapper id="workforce-scheduling" className="scroll-mt-24 bg-pulse-bg/80" showMobileSeparator>
      <div className="grid items-center gap-8 md:gap-10 lg:grid-cols-[minmax(0,3.5fr)_minmax(0,8.5fr)] lg:gap-8 xl:gap-10">
        <div className="order-1 mx-auto max-w-xl text-center lg:mx-0 lg:max-w-none lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-pulse-muted">Workforce</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-pulse-navy md:text-4xl">
            Keep your crew organized.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-pulse-muted md:text-lg">
            Plan shifts and assignments without confusion or overlap.
          </p>
          <ul className="mt-8 space-y-5 text-left">
            <FeatureItem title="Schedule workers by shift or zone" />
            <FeatureItem title="Adjust assignments quickly" description="Update who works where when plans change mid-week." />
            <FeatureItem title="See coverage gaps" description="Spot understaffed windows before the line starts." />
            <FeatureItem title="Track workload across teams" description="Balance hours and skills without a wall of sticky notes." />
          </ul>
        </div>

        <div className="order-2 flex min-w-0 justify-center lg:justify-end">
          <div className="w-full max-w-full origin-top max-md:-mb-4 max-md:scale-[0.92] sm:max-md:scale-[0.96] md:mb-0 md:scale-100">
            <SchedulingCalendarMock />
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
