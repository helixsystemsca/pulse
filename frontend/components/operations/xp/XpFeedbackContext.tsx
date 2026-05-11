"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { BadgeDto } from "@/lib/gamificationService";
import { useReducedEffects } from "@/hooks/useReducedEffects";
import { AchievementRevealLayer } from "@/components/operations/xp/AchievementRevealLayer";
import { LevelUpModal } from "@/components/operations/xp/LevelUpModal";
import { XpToastLayer } from "@/components/operations/xp/XpToastLayer";

export type XpToastModel = {
  id: string;
  amount: number;
  caption?: string;
  createdAt: number;
};

type LevelUpModel = {
  id: string;
  level: number;
  titleLine: string;
  subtitle?: string;
  badges: BadgeDto[];
};

type Ctx = {
  pushXpToast: (amount: number, caption?: string) => void;
  showLevelUp: (level: number, titleLine: string, options?: { subtitle?: string; badges?: BadgeDto[] }) => void;
  queueAchievementUnlocks: (badges: BadgeDto[]) => void;
};

const XpFeedbackContext = createContext<Ctx | null>(null);

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function XpFeedbackProvider({ children }: { children: ReactNode }) {
  const { reduced } = useReducedEffects();
  const [toasts, setToasts] = useState<XpToastModel[]>([]);
  const [levelUp, setLevelUp] = useState<LevelUpModel | null>(null);
  const [achievementQueue, setAchievementQueue] = useState<BadgeDto[]>([]);
  const toastTimers = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const t = toastTimers.current.get(id);
    if (t) window.clearTimeout(t);
    toastTimers.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const pushXpToast = useCallback(
    (amount: number, caption?: string) => {
      if (amount <= 0) return;
      const id = newId();
      const row: XpToastModel = { id, amount, caption, createdAt: Date.now() };
      setToasts((prev) => [...prev, row].slice(-5));
      const ms = reduced ? 650 : 1050;
      const handle = window.setTimeout(() => dismissToast(id), ms);
      toastTimers.current.set(id, handle);
    },
    [dismissToast, reduced],
  );

  const showLevelUp = useCallback((level: number, titleLine: string, options?: { subtitle?: string; badges?: BadgeDto[] }) => {
    setLevelUp({
      id: newId(),
      level,
      titleLine,
      subtitle: options?.subtitle,
      badges: options?.badges ?? [],
    });
  }, []);

  const queueAchievementUnlocks = useCallback((badges: BadgeDto[]) => {
    if (!badges.length) return;
    setAchievementQueue((prev) => [...prev, ...badges]);
  }, []);

  const value = useMemo(
    () => ({
      pushXpToast,
      showLevelUp,
      queueAchievementUnlocks,
    }),
    [pushXpToast, queueAchievementUnlocks, showLevelUp],
  );

  return (
    <XpFeedbackContext.Provider value={value}>
      {children}
      <XpToastLayer toasts={toasts} onDismiss={dismissToast} />
      <LevelUpModal
        open={Boolean(levelUp)}
        level={levelUp?.level ?? 1}
        titleLine={levelUp?.titleLine ?? ""}
        subtitle={levelUp?.subtitle}
        badges={levelUp?.badges ?? []}
        onClose={() => setLevelUp(null)}
      />
      <AchievementRevealLayer queue={achievementQueue} onShift={() => setAchievementQueue((prev) => prev.slice(1))} />
    </XpFeedbackContext.Provider>
  );
}

export function useXpFeedback() {
  const ctx = useContext(XpFeedbackContext);
  if (!ctx) {
    return {
      pushXpToast: () => {},
      showLevelUp: () => {},
      queueAchievementUnlocks: () => {},
    };
  }
  return ctx;
}
