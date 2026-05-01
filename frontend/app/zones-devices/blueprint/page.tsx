"use client";

import { X } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { APP_MODAL_PORTAL_Z_BASE } from "@/components/ui/app-modal-layer";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { canAccessLegacyBlueprintEditor } from "@/lib/legacy-blueprint-editor";
import { bpEase, bpDuration } from "@/lib/motion-presets";
import { readSession } from "@/lib/pulse-session";
import { motion } from "framer-motion";

const BlueprintDesigner = dynamic(
  () =>
    import("@/components/zones-devices/BlueprintDesigner").then((m) => ({
      default: m.BlueprintDesigner,
    })),
  {
    ssr: false,
    loading: () => (
      <motion.div
        className="bp-shell bp-shell--loading flex min-h-[min(40dvh,320px)] min-w-0 flex-1 flex-col"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: bpDuration.med, ease: bpEase }}
      >
        <p className="bp-muted m-auto">Loading blueprint editor…</p>
      </motion.div>
    ),
  },
);

const CLOSE_HREF = "/zones-devices/zones";

export default function BlueprintPage() {
  const router = useRouter();
  const { session } = usePulseAuth();

  const [portalReady, setPortalReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  const close = useCallback(() => {
    router.push(CLOSE_HREF);
  }, [router]);

  useLayoutEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveSession = mounted ? readSession() ?? session : null;
  const allowed = canAccessLegacyBlueprintEditor(effectiveSession);

  useEffect(() => {
    if (!mounted) return;
    if (!allowed) {
      router.replace("/drawings");
    }
  }, [allowed, mounted, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector(".bp-immersive-root--open")) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, []);

  if (!portalReady || !mounted) {
    return null;
  }

  if (!allowed) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ds-primary/90 text-sm text-ds-muted">
        Redirecting to Drawings…
      </div>
    );
  }

  const layer = (
    <div
      className={`pointer-events-auto fixed left-0 right-0 top-16 bottom-0 ${APP_MODAL_PORTAL_Z_BASE} flex min-h-0 flex-col items-center justify-center overflow-y-auto overflow-x-hidden p-2 sm:p-4 md:p-6`}
    >
      <button
        type="button"
        className="ds-modal-backdrop absolute inset-0 backdrop-blur-[2px]"
        aria-label="Close blueprint editor"
        onClick={close}
      />
      <div
        className="relative z-[1] flex h-[min(92dvh,900px)] w-full min-h-0 max-w-[min(96vw,120rem)] shrink flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xl dark:border-ds-border dark:bg-ds-primary"
        role="dialog"
        aria-modal="true"
        aria-labelledby="blueprint-dialog-title"
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 px-3 py-2.5 pr-2 dark:border-ds-border sm:px-4">
          <h2
            id="blueprint-dialog-title"
            className="truncate pl-0.5 text-sm font-semibold text-pulse-navy dark:text-slate-100 sm:text-base"
          >
            Legacy blueprint editor
          </h2>
          <button
            type="button"
            className="flex-shrink-0 rounded-lg p-2 text-pulse-muted hover:bg-slate-100 hover:text-pulse-navy dark:hover:bg-ds-interactive-hover"
            onClick={close}
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <BlueprintDesigner fullscreen legacyMigrationBanner legacyMigrationTools />
        </div>
      </div>
    </div>
  );

  return createPortal(layer, document.body);
}
