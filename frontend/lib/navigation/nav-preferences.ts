/**
 * User navigation preferences — presentation layer only (favorites / pins / recents).
 *
 * Not used for authorization. Full UI comes in a later phase; this module defines storage contracts.
 */

export type NavPreferenceFeatureRef = {
  /** Master registry key (`MasterFeatureDef.key`). */
  featureKey: string;
};

export type NavFavorite = NavPreferenceFeatureRef & {
  pinnedAt: string;
};

export type NavRecentEntry = NavPreferenceFeatureRef & {
  visitedAt: string;
};

export type NavUserPreferences = {
  favorites: NavFavorite[];
  recents: NavRecentEntry[];
};

export const NAV_PREFERENCES_STORAGE_KEY = "pulse.nav.preferences.v1";

const EMPTY: NavUserPreferences = { favorites: [], recents: [] };

export function readNavUserPreferences(): NavUserPreferences {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(NAV_PREFERENCES_STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY;
    const favorites = Array.isArray((parsed as NavUserPreferences).favorites)
      ? (parsed as NavUserPreferences).favorites
      : [];
    const recents = Array.isArray((parsed as NavUserPreferences).recents)
      ? (parsed as NavUserPreferences).recents
      : [];
    return { favorites, recents };
  } catch {
    return EMPTY;
  }
}

export function writeNavUserPreferences(prefs: NavUserPreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NAV_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / private mode */
  }
}

/** Phase 1 stub — records a favorite without UI. */
export function pinNavFeature(featureKey: string): NavUserPreferences {
  const current = readNavUserPreferences();
  if (current.favorites.some((f) => f.featureKey === featureKey)) return current;
  const next: NavUserPreferences = {
    ...current,
    favorites: [...current.favorites, { featureKey, pinnedAt: new Date().toISOString() }],
  };
  writeNavUserPreferences(next);
  return next;
}
