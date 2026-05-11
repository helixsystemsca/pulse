import type { BadgeDto } from "@/lib/gamificationService";

export const FEATURED_BADGES_KEY = "pulse.profile.featured-badges";
export const EQUIPPED_TITLE_KEY = "pulse.profile.equipped-title";

export type PortraitBorderDef = {
  id: string;
  label: string;
  /** Tailwind classes for the ring around the portrait */
  frameClass: string;
  /** Optional animated accent (applied when reduced effects off) */
  animatedClass?: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  unlockLevel?: number;
};

export const PORTRAIT_BORDERS: PortraitBorderDef[] = [
  {
    id: "bronze",
    label: "Bronze reliability",
    frameClass:
      "ring-2 ring-amber-800/50 shadow-[0_0_0_1px_rgba(245,158,11,0.12),0_12px_40px_rgba(146,64,14,0.18)]",
    rarity: "common",
    unlockLevel: 10,
  },
  {
    id: "silver",
    label: "Silver specialist",
    frameClass:
      "ring-2 ring-slate-300/80 dark:ring-slate-400/45 shadow-[0_0_28px_rgba(148,163,184,0.22)]",
    animatedClass: "xp-portrait-shimmer",
    rarity: "rare",
    unlockLevel: 20,
  },
  {
    id: "gold",
    label: "Gold operations",
    frameClass:
      "ring-2 ring-amber-400/70 shadow-[0_0_32px_rgba(251,191,36,0.28)]",
    animatedClass: "xp-portrait-glow",
    rarity: "epic",
    unlockLevel: 30,
  },
  {
    id: "elite",
    label: "Elite operator",
    frameClass:
      "ring-2 ring-violet-400/55 shadow-[0_0_36px_rgba(167,139,250,0.3)]",
    animatedClass: "xp-portrait-glow xp-portrait-shimmer",
    rarity: "legendary",
    unlockLevel: 50,
  },
];

/** Display titles the user may equip once their professional tier is high enough. */
export const DISPLAY_TITLES: { slug: string; label: string; minProfessionalLevel: number }[] = [
  { slug: "operator_i", label: "Operator I", minProfessionalLevel: 1 },
  { slug: "operator_ii", label: "Operator II", minProfessionalLevel: 2 },
  { slug: "senior_operator", label: "Senior Operator", minProfessionalLevel: 3 },
  { slug: "lead_operator", label: "Lead Operator", minProfessionalLevel: 4 },
  { slug: "systems_specialist", label: "Systems Specialist", minProfessionalLevel: 5 },
  { slug: "reliability_leader", label: "Reliability Leader", minProfessionalLevel: 6 },
  { slug: "compliance_champion", label: "Compliance Champion", minProfessionalLevel: 7 },
  { slug: "night_shift_veteran", label: "Night shift veteran", minProfessionalLevel: 4 },
  { slug: "cross_train_certified", label: "Cross-train certified", minProfessionalLevel: 3 },
];

export function portraitFrameForBorderId(
  borderId: string | null | undefined,
  options?: { allowAnimation?: boolean },
): { frameClass: string; animatedClass?: string } {
  const def = PORTRAIT_BORDERS.find((b) => b.id === borderId);
  if (!def) {
    return {
      frameClass: "ring-1 ring-white/30 dark:ring-white/15",
    };
  }
  return {
    frameClass: def.frameClass,
    animatedClass: options?.allowAnimation === false ? undefined : def.animatedClass,
  };
}

export function readFeaturedBadgeIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FEATURED_BADGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, 3);
  } catch {
    return [];
  }
}

export function writeFeaturedBadgeIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FEATURED_BADGES_KEY, JSON.stringify(ids.slice(0, 3)));
}

export function readEquippedTitleSlug(): string | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(EQUIPPED_TITLE_KEY);
  return v && v.length ? v : null;
}

export function writeEquippedTitleSlug(slug: string | null) {
  if (typeof window === "undefined") return;
  if (!slug) window.localStorage.removeItem(EQUIPPED_TITLE_KEY);
  else window.localStorage.setItem(EQUIPPED_TITLE_KEY, slug);
}

export function resolveEquippedTitleLabel(
  slug: string | null,
  fallbackFromAnalytics: string | undefined,
): string | null {
  if (slug) {
    const row = DISPLAY_TITLES.find((t) => t.slug === slug);
    if (row) return row.label;
  }
  return fallbackFromAnalytics?.trim() || null;
}

export function pickFeaturedBadges(catalog: BadgeDto[], ids: string[]): BadgeDto[] {
  const map = new Map(catalog.map((b) => [b.id, b]));
  return ids.map((id) => map.get(id)).filter((b): b is BadgeDto => Boolean(b && !b.isLocked && b.unlockedAt));
}
