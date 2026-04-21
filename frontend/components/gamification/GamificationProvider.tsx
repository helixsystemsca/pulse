"use client";

import { useCallback, useRef, useState } from "react";
import { usePulseWs } from "@/hooks/usePulseWs";
import { readSession } from "@/lib/pulse-session";
import { playLevelUp, playXpTick } from "@/lib/gamificationSounds";
import { BadgeUnlockModal, type BadgePayload } from "@/components/gamification/BadgeUnlockModal";
import { LevelUpModal } from "@/components/gamification/LevelUpModal";
import { XpGainToast, type XpToastPayload } from "@/components/gamification/XpGainToast";

type WsMeta = Record<string, unknown> | undefined;

function num(m: WsMeta, k: string): number {
  const v = m?.[k];
  return typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
}

function str(m: WsMeta, k: string): string {
  const v = m?.[k];
  return typeof v === "string" ? v : "";
}

export function GamificationProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<XpToastPayload | null>(null);
  const [levelUp, setLevelUp] = useState<{ old: number; next: number; borders: string[] } | null>(null);
  const [badge, setBadge] = useState<BadgePayload | null>(null);
  const me = readSession()?.sub ?? null;
  const toastClear = useRef<() => void>(() => {});

  toastClear.current = () => setToast(null);

  const onWs = useCallback(
    (evt: { event_type?: string; metadata?: unknown; payload?: unknown }) => {
      const md = (evt.metadata ?? evt.payload) as WsMeta;
      const uid = str(md, "user_id");
      if (!me || uid !== me) return;

      if (evt.event_type === "gamification.xp_awarded") {
        const amount = num(md, "amount");
        const reason = str(md, "reason") || str(md, "reason_code") || "XP earned";
        if (amount > 0) {
          playXpTick();
          try {
            if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(12);
          } catch {
            /* ignore */
          }
          setToast({ amount, reason, at: Date.now() });
        }
      }

      if (evt.event_type === "gamification.level_up") {
        playLevelUp();
        const oldL = num(md, "old_level");
        const newL = num(md, "new_level");
        const ub = md?.unlocked_borders;
        const borders = Array.isArray(ub) ? ub.map(String) : [];
        setLevelUp({ old: oldL, next: newL, borders });
      }

      if (evt.event_type === "gamification.badge_unlocked") {
        const b = md?.badge as Record<string, unknown> | undefined;
        if (b && typeof b === "object") {
          setBadge({
            id: String(b.id ?? ""),
            name: String(b.name ?? "Badge"),
            description: String(b.description ?? ""),
            iconKey: String(b.icon_key ?? b.iconKey ?? ""),
          });
        }
      }
    },
    [me],
  );

  usePulseWs(onWs, Boolean(me));

  return (
    <>
      {children}
      <XpGainToast toast={toast} onDone={() => toastClear.current()} />
      <LevelUpModal
        open={Boolean(levelUp)}
        oldLevel={levelUp?.old ?? 1}
        newLevel={levelUp?.next ?? 1}
        borders={levelUp?.borders ?? []}
        onClose={() => setLevelUp(null)}
      />
      <BadgeUnlockModal badge={badge} onClose={() => setBadge(null)} />
    </>
  );
}
