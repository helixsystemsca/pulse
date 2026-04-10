"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  countEntries,
  lastCompletedAt,
  loadInspectionsLogs,
  newId,
  saveInspectionsLogs,
  templatesByType,
} from "@/lib/inspectionsLogsStorage";
import type {
  EntryRecord,
  InspectionTemplate,
  LogTemplate,
  TemplateUnion,
} from "@/lib/inspectionsLogsTypes";
import { usePulseAuth } from "@/hooks/usePulseAuth";

export type InspectionsLogsStore = {
  scope: string;
  templates: TemplateUnion[];
  entries: EntryRecord[];
  inspectionTemplates: InspectionTemplate[];
  logTemplates: LogTemplate[];
  addTemplate: (t: TemplateUnion) => void;
  updateTemplate: (t: TemplateUnion) => void;
  removeTemplate: (id: string) => void;
  addEntry: (e: Omit<EntryRecord, "id"> & { id?: string }) => void;
  removeEntry: (id: string) => void;
  lastAt: (templateId: string) => string | null;
  entryCount: (templateId: string) => number;
  reload: () => void;
};

export function useInspectionsLogsStore(): InspectionsLogsStore {
  const { session } = usePulseAuth();
  const scope = useMemo(
    () => session?.company_id ?? session?.email ?? "default",
    [session?.company_id, session?.email],
  );

  const [templates, setTemplates] = useState<TemplateUnion[]>([]);
  const [entries, setEntries] = useState<EntryRecord[]>([]);

  const reload = useCallback(() => {
    const data = loadInspectionsLogs(scope);
    setTemplates(data.templates);
    setEntries(data.entries);
  }, [scope]);

  useEffect(() => {
    reload();
  }, [reload]);

  const persist = useCallback(
    (nextT: TemplateUnion[], nextE: EntryRecord[]) => {
      setTemplates(nextT);
      setEntries(nextE);
      saveInspectionsLogs(scope, { templates: nextT, entries: nextE });
    },
    [scope],
  );

  const addTemplate = useCallback(
    (t: TemplateUnion) => {
      persist([...templates, t], entries);
    },
    [templates, entries, persist],
  );

  const updateTemplate = useCallback(
    (t: TemplateUnion) => {
      persist(
        templates.map((x) => (x.id === t.id ? t : x)),
        entries,
      );
    },
    [templates, entries, persist],
  );

  const removeTemplate = useCallback(
    (id: string) => {
      persist(
        templates.filter((x) => x.id !== id),
        entries.filter((e) => e.template_id !== id),
      );
    },
    [templates, entries, persist],
  );

  const addEntry = useCallback(
    (e: Omit<EntryRecord, "id"> & { id?: string }) => {
      const row: EntryRecord = {
        ...e,
        id: e.id ?? newId(),
      };
      persist(templates, [...entries, row]);
    },
    [templates, entries, persist],
  );

  const removeEntry = useCallback(
    (id: string) => {
      persist(
        templates,
        entries.filter((e) => e.id !== id),
      );
    },
    [templates, entries, persist],
  );

  const lastAt = useCallback((templateId: string) => lastCompletedAt(entries, templateId), [entries]);

  const entryCount = useCallback((templateId: string) => countEntries(entries, templateId), [entries]);

  const inspectionTemplates = useMemo(
    () => templatesByType(templates, "inspection") as InspectionTemplate[],
    [templates],
  );

  const logTemplates = useMemo(
    () => templatesByType(templates, "log") as LogTemplate[],
    [templates],
  );

  return {
    scope,
    templates,
    entries,
    inspectionTemplates,
    logTemplates,
    addTemplate,
    updateTemplate,
    removeTemplate,
    addEntry,
    removeEntry,
    lastAt,
    entryCount,
    reload,
  };
}
