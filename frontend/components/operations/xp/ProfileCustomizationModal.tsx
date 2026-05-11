"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Card } from "@/components/pulse/Card";
import type { BadgeDto } from "@/lib/gamificationService";
import { cn } from "@/lib/cn";
import {
  DISPLAY_TITLES,
  PORTRAIT_BORDERS,
  readEquippedTitleSlug,
  readFeaturedBadgeIds,
  writeEquippedTitleSlug,
  writeFeaturedBadgeIds,
} from "@/lib/profileCosmetics";

export function ProfileCustomizationModal({
  open,
  onClose,
  avatarBorder,
  unlockedBorderIds,
  professionalLevel,
  badgeCatalog,
  onSelectBorder,
  borderBusy,
}: {
  open: boolean;
  onClose: () => void;
  avatarBorder: string | null;
  unlockedBorderIds: Set<string>;
  professionalLevel: number;
  badgeCatalog: BadgeDto[];
  onSelectBorder: (id: string | null) => void | Promise<void>;
  borderBusy?: boolean;
}) {
  const [titleSlug, setTitleSlug] = useState<string | null>(null);
  const [featured, setFeatured] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setTitleSlug(readEquippedTitleSlug());
    setFeatured(readFeaturedBadgeIds());
  }, [open]);

  const unlockedBadges = useMemo(
    () => badgeCatalog.filter((b) => b.unlockedAt && !b.isLocked),
    [badgeCatalog],
  );

  const titleOptions = useMemo(
    () => DISPLAY_TITLES.filter((t) => professionalLevel >= t.minProfessionalLevel),
    [professionalLevel],
  );

  function toggleFeatured(id: string) {
    setFeatured((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
  }

  function persistAndClose() {
    writeEquippedTitleSlug(titleSlug);
    writeFeaturedBadgeIds(featured);
    onClose();
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" aria-label="Close" onClick={persistAndClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-custom-heading"
            className="relative flex max-h-[min(92vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-ds-border bg-ds-primary shadow-2xl"
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <div className="flex items-center justify-between border-b border-ds-border px-6 py-4">
              <div>
                <p id="profile-custom-heading" className="font-headline text-lg font-extrabold text-ds-foreground">
                  Profile appearance
                </p>
                <p className="mt-0.5 text-xs text-ds-muted">Cosmetics stay tasteful — your workflows stay focused.</p>
              </div>
              <button
                type="button"
                className="rounded-full p-2 text-ds-muted transition hover:bg-ds-secondary hover:text-ds-foreground"
                onClick={persistAndClose}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ds-muted">Portrait border</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={borderBusy}
                    onClick={() => void onSelectBorder(null)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
                      !avatarBorder ? "border-ds-accent bg-ds-accent/10" : "border-ds-border bg-ds-secondary/50 hover:border-ds-accent/40",
                    )}
                  >
                    Default frame
                  </button>
                  {PORTRAIT_BORDERS.map((b) => {
                    const ok = unlockedBorderIds.has(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        disabled={borderBusy || !ok}
                        onClick={() => void onSelectBorder(b.id)}
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-left transition",
                          avatarBorder === b.id ? "border-ds-accent bg-ds-accent/10" : "border-ds-border bg-ds-secondary/50 hover:border-ds-accent/40",
                          !ok && "opacity-45",
                        )}
                      >
                        <p className="text-sm font-extrabold text-ds-foreground">{b.label}</p>
                        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ds-muted">
                          {b.rarity} · L{b.unlockLevel ?? "—"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="mt-8 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ds-muted">Displayed title</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTitleSlug(null)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-bold",
                      !titleSlug ? "border-ds-accent bg-ds-accent/10" : "border-ds-border bg-ds-secondary/60",
                    )}
                  >
                    Auto (tier)
                  </button>
                  {titleOptions.map((t) => (
                    <button
                      key={t.slug}
                      type="button"
                      onClick={() => setTitleSlug(t.slug)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-bold",
                        titleSlug === t.slug ? "border-ds-accent bg-ds-accent/10" : "border-ds-border bg-ds-secondary/60",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="mt-8 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ds-muted">Featured badges (up to 3)</h3>
                <Card padding="md" variant="secondary" className="max-h-64 overflow-y-auto">
                  <ul className="space-y-2">
                    {unlockedBadges.length === 0 ? (
                      <li className="text-sm text-ds-muted">Earn achievements to feature them here.</li>
                    ) : (
                      unlockedBadges.map((b) => {
                        const on = featured.includes(b.id);
                        return (
                          <li key={b.id}>
                            <button
                              type="button"
                              onClick={() => toggleFeatured(b.id)}
                              className={cn(
                                "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                                on ? "border-ds-accent bg-ds-accent/8" : "border-ds-border bg-ds-primary/60 hover:border-ds-accent/35",
                              )}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-extrabold text-ds-foreground">{b.name}</span>
                                <span className="mt-0.5 block truncate text-[11px] text-ds-muted">{b.description}</span>
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase",
                                  on ? "bg-ds-accent text-white" : "bg-ds-secondary text-ds-muted",
                                )}
                              >
                                {on ? "Shown" : "Add"}
                              </span>
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </Card>
              </section>
            </div>

            <div className="border-t border-ds-border px-6 py-4">
              <button
                type="button"
                className="w-full rounded-xl bg-ds-accent py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-95"
                onClick={persistAndClose}
              >
                Save &amp; close
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
