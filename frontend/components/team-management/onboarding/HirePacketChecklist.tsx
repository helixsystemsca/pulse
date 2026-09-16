"use client";

import { useState } from "react";
import { Check, FileSignature, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { dsCheckboxClass, dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import { HireProgressRing } from "@/components/team-management/onboarding/HireProgressRing";
import { completeHireOnboardingItem, type HirePacket, type HirePacketItem } from "@/lib/hireOnboardingService";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { cn } from "@/lib/cn";

function displayName(packet: HirePacket): string {
  return packet.full_name?.trim() || packet.email;
}

export function HirePacketChecklist({
  packet,
  companyId,
  onUpdated,
}: {
  packet: HirePacket;
  companyId: string | null;
  onUpdated: (next: HirePacket) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signDraft, setSignDraft] = useState<Record<string, { name: string; ack: boolean }>>({});

  async function completeReview(item: HirePacketItem) {
    setBusyId(item.id);
    setError(null);
    try {
      const next = await completeHireOnboardingItem(companyId, packet.user_id, item.id);
      onUpdated(next);
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setBusyId(null);
    }
  }

  async function completeSign(item: HirePacketItem) {
    const draft = signDraft[item.id] ?? { name: "", ack: false };
    if (!draft.ack || !draft.name.trim()) {
      setError("Typed name and acknowledgment are required to sign.");
      return;
    }
    setBusyId(item.id);
    setError(null);
    try {
      const next = await completeHireOnboardingItem(companyId, packet.user_id, item.id, {
        signature_name: draft.name.trim(),
        signed_ack: true,
      });
      onUpdated(next);
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <HireProgressRing percent={packet.progress.percent} />
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ds-foreground">{displayName(packet)}</h3>
          <p className="text-xs text-ds-muted">
            {packet.progress.required_completed} of {packet.progress.required_total} required documents complete
          </p>
        </div>
      </div>

      {error ? <p className="text-sm text-ds-danger">{error}</p> : null}

      <ul className="space-y-3">
        {packet.items.map((item) => {
          const done = item.status === "completed";
          const draft = signDraft[item.id] ?? { name: "", ack: false };
          return (
            <li key={item.id} className="ops-dash-inner-card p-4">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                    done
                      ? "border-[color-mix(in_srgb,var(--ds-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--ds-success)_12%,transparent)] text-[var(--ds-success)]"
                      : "border-ds-border text-ds-muted",
                  )}
                  aria-hidden
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : item.kind === "sign" ? (
                    <FileSignature className="h-3.5 w-3.5" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ds-foreground">{item.title}</p>
                    <span className="rounded-full border border-ds-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ds-muted">
                      {item.kind === "sign" ? "Sign" : "Review"}
                    </span>
                    {!item.is_required ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-ds-muted">Optional</span>
                    ) : null}
                  </div>
                  {item.description ? <p className="mt-1 text-xs text-ds-muted">{item.description}</p> : null}
                  {item.body_text ? (
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ds-foreground/90">
                      {item.body_text}
                    </p>
                  ) : null}

                  {done ? (
                    <p className="mt-3 text-xs text-ds-muted">
                      {item.kind === "sign" && item.signature_name
                        ? `Signed as ${item.signature_name}`
                        : "Marked reviewed"}
                    </p>
                  ) : item.kind === "sign" ? (
                    <div className="mt-3 space-y-2">
                      <label className="block">
                        <span className={dsLabelClass}>Typed name</span>
                        <input
                          className={cn(dsInputClass, "mt-1.5")}
                          value={draft.name}
                          onChange={(e) =>
                            setSignDraft((prev) => ({
                              ...prev,
                              [item.id]: { ...draft, name: e.target.value },
                            }))
                          }
                          placeholder="Employee full name"
                          autoComplete="name"
                        />
                      </label>
                      <label className="flex items-start gap-2 text-sm text-ds-foreground">
                        <input
                          type="checkbox"
                          className={cn(dsCheckboxClass, "mt-0.5")}
                          checked={draft.ack}
                          onChange={(e) =>
                            setSignDraft((prev) => ({
                              ...prev,
                              [item.id]: { ...draft, ack: e.target.checked },
                            }))
                          }
                        />
                        <span>I acknowledge this document on behalf of this hire.</span>
                      </label>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-8 px-3 text-xs"
                        disabled={busyId === item.id}
                        onClick={() => void completeSign(item)}
                      >
                        {busyId === item.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                        Record signature
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-3 h-8 px-3 text-xs"
                      disabled={busyId === item.id}
                      onClick={() => void completeReview(item)}
                    >
                      {busyId === item.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                      Mark reviewed
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
