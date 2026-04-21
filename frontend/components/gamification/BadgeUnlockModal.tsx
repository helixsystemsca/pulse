"use client";

export type BadgePayload = { id: string; name: string; description: string; iconKey?: string };

export function BadgeUnlockModal({ badge, onClose }: { badge: BadgePayload | null; onClose: () => void }) {
  if (!badge) return null;

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-ds-border bg-ds-primary p-6 text-center shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ds-warning">Badge unlocked</p>
        <div className="mx-auto mt-4 grid h-16 w-16 place-items-center rounded-2xl border border-ds-border bg-ds-secondary text-2xl">
          {badge.iconKey === "flame" ? "🔥" : badge.iconKey === "wrench" ? "🔧" : "🏅"}
        </div>
        <h2 className="mt-3 text-xl font-extrabold text-ds-foreground">{badge.name}</h2>
        <p className="mt-2 text-sm text-ds-muted">{badge.description}</p>
        <button type="button" className="ds-btn-solid-primary mt-6 w-full py-2.5 text-sm font-bold" onClick={onClose}>
          Nice
        </button>
      </div>
    </div>
  );
}
