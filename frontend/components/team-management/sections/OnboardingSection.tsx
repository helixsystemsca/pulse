"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ListChecks, Loader2 } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { HirePacketChecklist } from "@/components/team-management/onboarding/HirePacketChecklist";
import { HireProgressRing } from "@/components/team-management/onboarding/HireProgressRing";
import { HireTemplateEditor } from "@/components/team-management/onboarding/HireTemplateEditor";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { useTeamEmployees } from "@/lib/team-management/hooks/useTeamEmployees";
import {
  ensureWorkerHireOnboarding,
  fetchHireOnboardingPackets,
  fetchHireOnboardingTemplate,
  saveHireOnboardingTemplate,
  type HirePacket,
  type HireTemplateItemWrite,
} from "@/lib/hireOnboardingService";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { displayName } from "@/lib/team-management/development-types";
import { cn } from "@/lib/cn";

function packetName(packet: HirePacket): string {
  return packet.full_name?.trim() || packet.email;
}

export function OnboardingSection() {
  const searchParams = useSearchParams();
  const hireParam = searchParams.get("hire");
  const { session } = usePulseAuth();
  const companyId = session?.company_id ?? null;
  const { employees } = useTeamEmployees({ includeInactive: true });
  const [packets, setPackets] = useState<HirePacket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(hireParam);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("Default hire packet");
  const [templateItems, setTemplateItems] = useState<HireTemplateItemWrite[]>([]);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [attachUserId, setAttachUserId] = useState("");
  const [attachBusy, setAttachBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, template] = await Promise.all([
        fetchHireOnboardingPackets(companyId),
        fetchHireOnboardingTemplate(companyId),
      ]);
      setPackets(list.items);
      setTemplateName(template.name);
      setTemplateItems(
        template.items.map((item) => ({
          id: item.id,
          key: item.key,
          title: item.title,
          description: item.description,
          kind: item.kind,
          body_text: item.body_text,
          applies_when: item.applies_when,
          is_required: item.is_required,
        })),
      );
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (hireParam) setSelectedId(hireParam);
  }, [hireParam]);

  const selected = useMemo(
    () => packets.find((p) => p.user_id === selectedId) ?? packets[0] ?? null,
    [packets, selectedId],
  );

  const withoutPacket = useMemo(() => {
    const have = new Set(packets.map((p) => p.user_id));
    return employees.filter((e) => e.is_active && !have.has(e.id));
  }, [employees, packets]);

  async function saveTemplate() {
    setTemplateSaving(true);
    setError(null);
    try {
      const saved = await saveHireOnboardingTemplate(companyId, {
        name: templateName,
        items: templateItems.filter((i) => i.title.trim()),
      });
      setTemplateName(saved.name);
      setTemplateItems(
        saved.items.map((item) => ({
          id: item.id,
          key: item.key,
          title: item.title,
          description: item.description,
          kind: item.kind,
          body_text: item.body_text,
          applies_when: item.applies_when,
          is_required: item.is_required,
        })),
      );
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setTemplateSaving(false);
    }
  }

  async function attachPacket() {
    if (!attachUserId) return;
    setAttachBusy(true);
    setError(null);
    try {
      const packet = await ensureWorkerHireOnboarding(companyId, attachUserId);
      setPackets((prev) => {
        const rest = prev.filter((p) => p.user_id !== packet.user_id);
        return [packet, ...rest];
      });
      setSelectedId(packet.user_id);
      setAttachUserId("");
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setAttachBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding"
        description="Required hire documents — review or sign each item. Progress is stored on the hire record."
        icon={ListChecks}
      />
      <PageBody>
        {loading ? (
          <div className="flex min-h-[10rem] items-center justify-center text-ds-muted">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          </div>
        ) : error && packets.length === 0 ? (
          <p className="text-sm text-ds-danger">{error}</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
            <aside className="space-y-3">
              <div className="ops-dash-inner-card p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ds-muted">Open hires</p>
                {packets.length === 0 ? (
                  <p className="mt-2 text-xs text-ds-muted">
                    Adding an employee on{" "}
                    <Link href="/dashboard/permissions" className="font-semibold text-[var(--ds-accent)]">
                      Permissions
                    </Link>{" "}
                    attaches this packet automatically.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {packets.map((packet) => {
                      const active = selected?.user_id === packet.user_id;
                      return (
                        <li key={packet.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(packet.user_id)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs",
                              active ? "bg-[color-mix(in_srgb,var(--ds-accent)_10%,transparent)]" : "hover:bg-ds-secondary/60",
                            )}
                          >
                            <HireProgressRing percent={packet.progress.percent} size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-ds-foreground">{packetName(packet)}</span>
                              <span className="text-ds-muted">
                                {packet.progress.required_completed}/{packet.progress.required_total}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {withoutPacket.length > 0 ? (
                <div className="ops-dash-inner-card space-y-2 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ds-muted">Attach to existing employee</p>
                  <select
                    className="w-full rounded-lg border border-ds-border bg-white px-2 py-1.5 text-xs dark:bg-ds-secondary"
                    value={attachUserId}
                    onChange={(e) => setAttachUserId(e.target.value)}
                  >
                    <option value="">Select employee</option>
                    {withoutPacket.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {displayName({ full_name: emp.full_name, email: emp.email })}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 w-full px-3 text-xs"
                    disabled={!attachUserId || attachBusy}
                    onClick={() => void attachPacket()}
                  >
                    Attach packet
                  </Button>
                </div>
              ) : null}
            </aside>

            <div className="space-y-4">
              {error ? <p className="text-sm text-ds-danger">{error}</p> : null}
              {selected ? (
                <HirePacketChecklist
                  packet={selected}
                  companyId={companyId}
                  onUpdated={(next) => {
                    setPackets((prev) => prev.map((p) => (p.id === next.id ? next : p)));
                  }}
                />
              ) : (
                <div className="ops-dash-inner-card p-5 text-sm text-ds-muted">
                  No hire packets yet. Create an employee to attach the default required-document list.
                </div>
              )}

              <div className="ops-dash-inner-card p-4">
                <button
                  type="button"
                  className="text-sm font-bold text-ds-foreground"
                  onClick={() => setTemplateOpen((v) => !v)}
                >
                  Required document template
                  <span className="ml-2 text-xs font-normal text-ds-muted">{templateOpen ? "Hide" : "Edit"}</span>
                </button>
                {templateOpen ? (
                  <div className="mt-4">
                    <p className="mb-3 text-xs text-ds-muted">
                      Changes apply to new hires. Plant / ice items attach when the job title or department matches
                      plant, arena, ammonia, or ice-plant work.
                    </p>
                    <HireTemplateEditor
                      name={templateName}
                      items={templateItems}
                      onNameChange={setTemplateName}
                      onItemsChange={setTemplateItems}
                      saving={templateSaving}
                      onSave={() => void saveTemplate()}
                    />
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-ds-muted">{templateItems.length} documents in the default packet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </PageBody>
    </div>
  );
}
