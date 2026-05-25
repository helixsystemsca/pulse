/**
 * Learning Bundles — grouped training assignments (procedures today; external items later).
 * Persisted per-company in localStorage until a dedicated API exists.
 */
import { readSession } from "@/lib/pulse-session";

export type LearningBundleItemSource = "procedure" | "external";

export type LearningBundleItem = {
  id: string;
  source: LearningBundleItemSource;
  /** Procedure id when source=procedure; external URL/id when source=external */
  ref_id: string;
  label: string;
  sort_order: number;
};

export type LearningBundleCategory =
  | "onboarding"
  | "operations"
  | "certification_track"
  | "supervisor"
  | "seasonal"
  | "other";

export type LearningBundle = {
  id: string;
  title: string;
  description: string;
  category: LearningBundleCategory;
  items: LearningBundleItem[];
  /** Default days until due when assigned (optional). */
  due_within_days: number | null;
  /** Months after completion before renewal (optional; future compliance hook). */
  renewal_months: number | null;
  requires_acknowledgement: boolean;
  requires_upload: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const STORAGE_KEY_PREFIX = "pulse-learning-bundles";

function storageKey(companyId: string): string {
  return `${STORAGE_KEY_PREFIX}:${companyId}`;
}

export const LEARNING_BUNDLE_CATEGORY_LABELS: Record<LearningBundleCategory, string> = {
  onboarding: "Onboarding",
  operations: "Arena / operations",
  certification_track: "Certification track",
  supervisor: "Supervisor readiness",
  seasonal: "Seasonal worker",
  other: "Other",
};

const DEFAULT_BUNDLES: Omit<LearningBundle, "created_at" | "updated_at">[] = [
  {
    id: "bundle-new-hire",
    title: "New Hire Onboarding",
    description: "Core orientation and safety baseline for new workers.",
    category: "onboarding",
    items: [],
    due_within_days: 14,
    renewal_months: null,
    requires_acknowledgement: true,
    requires_upload: false,
    active: true,
  },
  {
    id: "bundle-arena-ops",
    title: "Arena Operations",
    description: "Day-to-day arena operating procedures.",
    category: "operations",
    items: [],
    due_within_days: 30,
    renewal_months: 12,
    requires_acknowledgement: true,
    requires_upload: false,
    active: true,
  },
  {
    id: "bundle-ro-track",
    title: "Refrigeration Operator Track",
    description: "Progression toward RO competency (procedure-backed).",
    category: "certification_track",
    items: [],
    due_within_days: 60,
    renewal_months: 24,
    requires_acknowledgement: true,
    requires_upload: true,
    active: true,
  },
  {
    id: "bundle-supervisor",
    title: "Supervisor Readiness",
    description: "Leadership and oversight procedures.",
    category: "supervisor",
    items: [],
    due_within_days: 45,
    renewal_months: 12,
    requires_acknowledgement: true,
    requires_upload: false,
    active: true,
  },
  {
    id: "bundle-seasonal",
    title: "Seasonal Worker Training",
    description: "Short-cycle training for seasonal staff.",
    category: "seasonal",
    items: [],
    due_within_days: 7,
    renewal_months: null,
    requires_acknowledgement: true,
    requires_upload: false,
    active: true,
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function seedBundles(): LearningBundle[] {
  const t = nowIso();
  return DEFAULT_BUNDLES.map((b) => ({ ...b, created_at: t, updated_at: t }));
}

export function readLearningBundles(companyId: string | null): LearningBundle[] {
  if (typeof window === "undefined" || !companyId) return seedBundles();
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    if (!raw) {
      const seeded = seedBundles();
      writeLearningBundles(companyId, seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as LearningBundle[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedBundles();
  } catch {
    return seedBundles();
  }
}

export function writeLearningBundles(companyId: string, bundles: LearningBundle[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(companyId), JSON.stringify(bundles));
}

export function readLearningBundlesForSession(): LearningBundle[] {
  const companyId = readSession()?.company_id ?? null;
  return readLearningBundles(companyId);
}

export function upsertLearningBundle(
  companyId: string,
  bundle: LearningBundle,
): LearningBundle[] {
  const list = readLearningBundles(companyId);
  const idx = list.findIndex((b) => b.id === bundle.id);
  const next = [...list];
  if (idx >= 0) next[idx] = { ...bundle, updated_at: nowIso() };
  else next.push(bundle);
  writeLearningBundles(companyId, next);
  return next;
}

export function createLearningBundleId(): string {
  return `bundle-${Date.now().toString(36)}`;
}

export function procedureIdsInBundle(bundle: LearningBundle): string[] {
  return bundle.items.filter((i) => i.source === "procedure").map((i) => i.ref_id);
}
