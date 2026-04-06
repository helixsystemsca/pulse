import type {
  EntryRecord,
  InspectionsLogsStoreData,
  TemplateUnion,
} from "@/lib/inspectionsLogsTypes";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function keyForScope(scope: string): string {
  return `pulse_il_v1_${encodeURIComponent(scope)}`;
}

const EMPTY: InspectionsLogsStoreData = { templates: [], entries: [] };

export function loadInspectionsLogs(scope: string): InspectionsLogsStoreData {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(keyForScope(scope));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as InspectionsLogsStoreData;
    if (!parsed || !Array.isArray(parsed.templates) || !Array.isArray(parsed.entries)) return EMPTY;
    return parsed;
  } catch {
    return EMPTY;
  }
}

export function saveInspectionsLogs(scope: string, data: InspectionsLogsStoreData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(keyForScope(scope), JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

export function entriesForTemplate(entries: EntryRecord[], templateId: string): EntryRecord[] {
  return entries.filter((e) => e.template_id === templateId);
}

export function lastCompletedAt(entries: EntryRecord[], templateId: string): string | null {
  const list = entriesForTemplate(entries, templateId);
  if (list.length === 0) return null;
  const sorted = [...list].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return sorted[0]?.created_at ?? null;
}

export function countEntries(entries: EntryRecord[], templateId: string): number {
  return entriesForTemplate(entries, templateId).length;
}

export function templatesByType(templates: TemplateUnion[], type: TemplateUnion["type"]): TemplateUnion[] {
  return templates.filter((t) => t.type === type);
}
