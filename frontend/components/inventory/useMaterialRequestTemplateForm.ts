"use client";

import { useEffect, useState } from "react";
import {
  fetchMaterialRequestTemplateForm,
  type MaterialRequestTemplateForm,
  type MaterialRequestTemplateFormField,
} from "@/lib/inventoryMaterialRequestsService";
import { readSession } from "@/lib/pulse-session";

const FALLBACK_FIELDS: MaterialRequestTemplateFormField[] = [
  { key: "project", label: "Project", required: true, placeholder: "e.g. KEARL", multiline: false, options: [] },
  {
    key: "cost_object",
    label: "Cost object",
    required: false,
    placeholder: "Optional",
    multiline: false,
    options: [],
  },
  {
    key: "location",
    label: "Job description / location",
    required: true,
    placeholder: "e.g. Office consumables",
    multiline: false,
    options: [],
  },
  {
    key: "comments",
    label: "Comments",
    required: false,
    placeholder: "Optional",
    multiline: true,
    options: [],
  },
];

export function useMaterialRequestTemplateForm(enabled: boolean) {
  const [fields, setFields] = useState<MaterialRequestTemplateFormField[]>(FALLBACK_FIELDS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const companyId = readSession()?.company_id ?? null;
    setLoading(true);
    void fetchMaterialRequestTemplateForm(companyId)
      .then((form: MaterialRequestTemplateForm) => {
        if (!cancelled && form.fields.length > 0) {
          setFields(form.fields);
        }
      })
      .catch(() => {
        if (!cancelled) setFields(FALLBACK_FIELDS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { fields, loading };
}
