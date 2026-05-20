/**
 * Tenant-scoped assignment palette configuration (badges in localStorage; shifts via API).
 */
import {
  OPERATIONAL_BADGE_REGISTRY,
  type OperationalBadgeDefinition,
  type OperationalBadgeGroup,
  STANDARD_SHIFT_CATALOG,
  type StandardShiftDefinition,
} from "@/lib/schedule/operational-scheduling-model";
import { bandForWindow } from "@/lib/schedule/shift-definition-catalog";
import type { ShiftTypeKey } from "@/lib/schedule/types";

export type CustomPaletteBadge = OperationalBadgeDefinition & {
  id: string;
};

export type PaletteBadgeConfig = {
  /** Built-in registry codes hidden from the draggable palette (data model unchanged). */
  hiddenBuiltinCodes: string[];
  customBadges: CustomPaletteBadge[];
};

const STORAGE_VERSION = "v1";
const DEFAULT_CONFIG: PaletteBadgeConfig = { hiddenBuiltinCodes: [], customBadges: [] };

let activeBadgeRegistry: Record<string, OperationalBadgeDefinition> = { ...OPERATIONAL_BADGE_REGISTRY };

export function getActivePaletteBadgeRegistry(): Record<string, OperationalBadgeDefinition> {
  return activeBadgeRegistry;
}

export function setActivePaletteBadgeRegistry(registry: Record<string, OperationalBadgeDefinition>): void {
  activeBadgeRegistry = registry;
}

function storageKey(companyId: string): string {
  return `pulse.schedule.palette.badges.${STORAGE_VERSION}:${companyId}`;
}

export function loadPaletteBadgeConfig(companyId: string | null | undefined): PaletteBadgeConfig {
  if (!companyId || typeof window === "undefined") return { ...DEFAULT_CONFIG, customBadges: [] };
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    if (!raw) return { hiddenBuiltinCodes: [], customBadges: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { hiddenBuiltinCodes: [], customBadges: [] };
    const o = parsed as Partial<PaletteBadgeConfig>;
    const hiddenBuiltinCodes = Array.isArray(o.hiddenBuiltinCodes)
      ? o.hiddenBuiltinCodes.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
      : [];
    const customBadges = Array.isArray(o.customBadges)
      ? o.customBadges
          .map(normalizeCustomBadge)
          .filter((b): b is CustomPaletteBadge => Boolean(b))
      : [];
    return { hiddenBuiltinCodes, customBadges };
  } catch {
    return { hiddenBuiltinCodes: [], customBadges: [] };
  }
}

export function savePaletteBadgeConfig(companyId: string, config: PaletteBadgeConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(companyId), JSON.stringify(config));
}

function normalizeCustomBadge(raw: unknown): CustomPaletteBadge | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const code = String(o.code ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "");
  if (!code) return null;
  const group = normalizeBadgeGroup(String(o.group ?? "special"));
  const id = String(o.id ?? `custom-${code}`).trim() || `custom-${code}`;
  return {
    id,
    code,
    label: String(o.label ?? code).trim() || code,
    group,
    detail: o.detail != null ? String(o.detail).trim() : undefined,
    chipLabel: o.chipLabel != null ? String(o.chipLabel).trim() : undefined,
  };
}

function normalizeBadgeGroup(raw: string): OperationalBadgeGroup {
  const g = raw.trim().toLowerCase();
  if (g === "leave" || g === "training" || g === "assignment" || g === "workflow" || g === "special") {
    return g;
  }
  return "special";
}

export function buildPaletteBadgeRegistry(config: PaletteBadgeConfig): Record<string, OperationalBadgeDefinition> {
  const hidden = new Set(config.hiddenBuiltinCodes.map((c) => c.toUpperCase()));
  const out: Record<string, OperationalBadgeDefinition> = {};
  for (const [code, def] of Object.entries(OPERATIONAL_BADGE_REGISTRY)) {
    if (!hidden.has(code)) out[code] = def;
  }
  for (const custom of config.customBadges) {
    out[custom.code.toUpperCase()] = custom;
  }
  return out;
}

export function listPaletteBadgeCodes(registry: Record<string, OperationalBadgeDefinition>): string[] {
  return Object.keys(registry).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** All badge codes for the manage dialog (includes hidden built-ins). */
export function listManageBadgeCodes(config: PaletteBadgeConfig): string[] {
  const visible = listPaletteBadgeCodes(buildPaletteBadgeRegistry(config));
  const hidden = config.hiddenBuiltinCodes
    .map((c) => c.toUpperCase())
    .filter((c) => c && !visible.includes(c));
  return [...visible, ...hidden].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function hhmmFromMinutes(m: number): string {
  const mm = Math.max(0, Math.min(1439, Math.floor(m)));
  const h = String(Math.floor(mm / 60)).padStart(2, "0");
  const r = String(mm % 60).padStart(2, "0");
  return `${h}:${r}`;
}

export function minutesFromHhmm(s: string): number {
  const [h, m] = (s || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(1439, h * 60 + m));
}

export type ScheduleShiftDefinitionRow = {
  id: string;
  code: string;
  name?: string | null;
  start_min: number;
  end_min: number;
  shift_type: string;
  color?: string | null;
};

export function shiftDefinitionsToPalette(defs: ScheduleShiftDefinitionRow[]): StandardShiftDefinition[] {
  if (!defs.length) return [...STANDARD_SHIFT_CATALOG];
  return defs.map((d) => {
    const start = hhmmFromMinutes(d.start_min);
    const end = hhmmFromMinutes(d.end_min);
    const bandRaw = d.shift_type?.trim().toLowerCase();
    const band: ShiftTypeKey =
      bandRaw === "day" || bandRaw === "afternoon" || bandRaw === "night"
        ? bandRaw
        : bandForWindow(start, end);
    return {
      code: d.code.trim().toUpperCase(),
      label: d.name?.trim() || d.code.trim().toUpperCase(),
      band,
      start,
      end,
    };
  });
}

export const BADGE_GROUP_OPTIONS: { value: OperationalBadgeGroup; label: string }[] = [
  { value: "workflow", label: "Workflow" },
  { value: "leave", label: "Leave" },
  { value: "training", label: "Training" },
  { value: "assignment", label: "Assignment" },
  { value: "special", label: "Special" },
];

export function isBuiltinPaletteBadge(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(OPERATIONAL_BADGE_REGISTRY, code.toUpperCase());
}
