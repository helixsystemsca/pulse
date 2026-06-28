/** Per-user flashcard study preferences (client storage until a preferences API exists). */

import { useCallback, useEffect, useState } from "react";
import { readSession } from "@/lib/pulse-session";

export type FlashcardStudySettings = {
  shuffleCards: boolean;
  hideMasteredCards: boolean;
  studyNewCardsOnly: boolean;
  studyIncorrectCardsOnly: boolean;
  reverseQuestionAnswer: boolean;
  resumePreviousSession: boolean;
};

export const DEFAULT_FLASHCARD_STUDY_SETTINGS: FlashcardStudySettings = {
  shuffleCards: false,
  hideMasteredCards: false,
  studyNewCardsOnly: false,
  studyIncorrectCardsOnly: false,
  reverseQuestionAnswer: false,
  resumePreviousSession: true,
};

const STORAGE_KEY = "helix.training.flashcards.settings.v1";

type SettingsStore = Record<string, FlashcardStudySettings>;

function readStore(): SettingsStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as SettingsStore;
  } catch {
    return {};
  }
}

function writeStore(store: SettingsStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export function flashcardStudySettingsUserId(): string | null {
  return readSession()?.sub ?? null;
}

export function readFlashcardStudySettings(userId: string | null): FlashcardStudySettings {
  if (!userId) return { ...DEFAULT_FLASHCARD_STUDY_SETTINGS };
  const stored = readStore()[userId];
  if (!stored) return { ...DEFAULT_FLASHCARD_STUDY_SETTINGS };
  return { ...DEFAULT_FLASHCARD_STUDY_SETTINGS, ...stored };
}

export function writeFlashcardStudySettings(
  userId: string | null,
  settings: FlashcardStudySettings,
): void {
  if (!userId) return;
  const store = readStore();
  store[userId] = settings;
  writeStore(store);
}

export function useFlashcardStudySettings(): {
  settings: FlashcardStudySettings;
  setSettings: (next: FlashcardStudySettings) => void;
  patchSettings: (patch: Partial<FlashcardStudySettings>) => void;
  userId: string | null;
} {
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettingsState] = useState<FlashcardStudySettings>(
    DEFAULT_FLASHCARD_STUDY_SETTINGS,
  );

  useEffect(() => {
    const id = flashcardStudySettingsUserId();
    setUserId(id);
    setSettingsState(readFlashcardStudySettings(id));
  }, []);

  const setSettings = useCallback(
    (next: FlashcardStudySettings) => {
      setSettingsState(next);
      writeFlashcardStudySettings(userId ?? flashcardStudySettingsUserId(), next);
    },
    [userId],
  );

  const patchSettings = useCallback(
    (patch: Partial<FlashcardStudySettings>) => {
      setSettingsState((prev) => {
        const next = { ...prev, ...patch };
        writeFlashcardStudySettings(userId ?? flashcardStudySettingsUserId(), next);
        return next;
      });
    },
    [userId],
  );

  return { settings, setSettings, patchSettings, userId };
}
