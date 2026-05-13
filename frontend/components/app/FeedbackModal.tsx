"use client";

import { Megaphone, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { APP_MODAL_PORTAL_Z_BASE } from "@/components/ui/app-modal-layer";
import { cn } from "@/lib/cn";
import { isApiMode } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { fetchFeedbackFeatures, submitFeedback, type FeedbackFeatureOption } from "@/lib/feedbackApi";
import { dsInputClass } from "@/components/ui/ds-form-classes";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
};

export function FeedbackModal({ open, onClose, onSubmitted }: Props) {
  const [features, setFeatures] = useState<FeedbackFeatureOption[]>([]);
  const [featureKey, setFeatureKey] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = useCallback(() => {
    setFeatureKey("");
    setComment("");
    setSubmitErr(null);
    setDone(false);
    setLoadErr(null);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    if (!isApiMode()) {
      setLoadErr("API is not configured for this environment.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const list = await fetchFeedbackFeatures();
        if (!cancelled) {
          setFeatures(list);
        }
      } catch (e) {
        if (!cancelled) setLoadErr(parseClientApiError(e).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reset]);

  useEffect(() => {
    if (features.length && !featureKey) {
      setFeatureKey(features[0]!.id);
    }
  }, [features, featureKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitErr(null);
    if (!featureKey.trim()) {
      setSubmitErr("Choose what your feedback relates to.");
      return;
    }
    if (comment.trim().length < 4) {
      setSubmitErr("Please add a bit more detail (at least a few characters).");
      return;
    }
    setLoading(true);
    try {
      await submitFeedback({ feature_key: featureKey.trim(), body: comment.trim() });
      setDone(true);
      onSubmitted?.();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pulse-feedback-submitted"));
      }
    } catch (err) {
      setSubmitErr(parseClientApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className={cn(APP_MODAL_PORTAL_Z_BASE, "fixed inset-0 flex items-center justify-center p-4")}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pulse-feedback-title"
    >
      <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <div className="relative flex max-h-[min(32rem,88vh)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-ds-border bg-ds-elevated shadow-[var(--ds-shadow-diffuse)]">
        <div className="flex items-start justify-between gap-3 border-b border-ds-border px-4 py-3">
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--ds-accent)_18%,transparent)] text-[var(--ds-accent)]">
              <Megaphone className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id="pulse-feedback-title" className="text-sm font-semibold text-ds-foreground">
                Send product feedback
              </h2>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ds-muted">
                Your message goes to company administrators. Include enough context to be actionable.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-ds-muted hover:bg-ds-secondary hover:text-ds-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {done ? (
            <p className="text-sm text-ds-foreground">
              Thanks — your feedback was sent. Administrators can review it under{" "}
              <span className="font-semibold">Messages</span> in the header.
            </p>
          ) : loadErr ? (
            <p className="text-sm text-ds-danger" role="alert">
              {loadErr}
            </p>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
                <label htmlFor="pulse-feedback-feature" className="mb-1 block text-xs font-semibold text-ds-muted">
                  Related area
                </label>
                <select
                  id="pulse-feedback-feature"
                  className={cn(dsInputClass, "w-full")}
                  value={featureKey}
                  onChange={(e) => setFeatureKey(e.target.value)}
                  disabled={loading || features.length === 0}
                >
                  {features.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pulse-feedback-comment" className="mb-1 block text-xs font-semibold text-ds-muted">
                  Comment
                </label>
                <textarea
                  id="pulse-feedback-comment"
                  className={cn(dsInputClass, "min-h-[8rem] w-full resize-y")}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What would you improve or what went wrong?"
                  maxLength={4000}
                  disabled={loading}
                />
                <p className="mt-1 text-[10px] text-ds-muted">{comment.length} / 4000</p>
              </div>
              {submitErr ? (
                <p className="text-xs font-medium text-ds-danger" role="alert">
                  {submitErr}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="rounded-lg border border-ds-border px-3 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-[var(--ds-accent)] px-3 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                >
                  {loading ? "Sending…" : "Submit feedback"}
                </button>
              </div>
            </form>
          )}
        </div>

        {done ? (
          <div className="border-t border-ds-border px-4 py-3 text-right">
            <button
              type="button"
              className="rounded-lg bg-[var(--ds-accent)] px-3 py-2 text-sm font-semibold text-white hover:opacity-95"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
