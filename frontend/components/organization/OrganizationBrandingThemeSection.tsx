"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/pulse/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { dsFormHintClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import { cn } from "@/lib/cn";
import {
  DEFAULT_ORGANIZATION_BRAND_COLORS,
  dispatchOrganizationThemeChange,
  ORGANIZATION_BRAND_COLOR_KEYS,
  ORGANIZATION_BRAND_LABELS,
  normalizeOrganizationBrandColors,
  resolveOrganizationBrandColors,
  writeStoredOrganizationBrandColors,
  type OrganizationBrandColors,
} from "@/lib/theme/organization-branding";
import { buttonVariants } from "@/styles/button-variants";

type Props = {
  companyId: string;
};

export function OrganizationBrandingThemeSection({ companyId }: Props) {
  const [draft, setDraft] = useState<OrganizationBrandColors>(DEFAULT_ORGANIZATION_BRAND_COLORS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(resolveOrganizationBrandColors({ id: companyId, name: "" }));
  }, [companyId]);

  const onColor = (key: keyof OrganizationBrandColors, value: string) => {
    setSaved(false);
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreview = useCallback(() => {
    const normalized = normalizeOrganizationBrandColors(draft);
    setDraft(normalized);
    writeStoredOrganizationBrandColors(companyId, normalized);
    dispatchOrganizationThemeChange();
    setSaved(true);
  }, [companyId, draft]);

  const resetDefaults = () => {
    setDraft({ ...DEFAULT_ORGANIZATION_BRAND_COLORS });
    setSaved(false);
  };

  return (
    <Card variant="secondary" padding="lg">
      <SectionHeader
        title="Theme colors"
        description="Preview brand colors for your organization. Saved locally for this browser until server-side branding is enabled. Primary maps to buttons, nav active states, and links."
      />
      <p className={cn(dsFormHintClass, "mt-2")}>
        Adjust the five identity colors below. Success, warning, and danger also drive compliance and operational status
        indicators app-wide.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ORGANIZATION_BRAND_COLOR_KEYS.map((key) => (
          <label key={key} className="block text-sm">
            <span className={dsLabelClass}>{ORGANIZATION_BRAND_LABELS[key]}</span>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="color"
                value={draft[key]}
                onChange={(e) => onColor(key, e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-ds-border bg-ds-primary p-0.5"
                aria-label={ORGANIZATION_BRAND_LABELS[key]}
              />
              <input
                type="text"
                value={draft[key]}
                onChange={(e) => onColor(key, e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-ds-border bg-ds-primary px-2 py-1.5 font-mono text-xs text-ds-foreground"
                spellCheck={false}
              />
            </div>
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={applyPreview}
          className={cn(buttonVariants({ surface: "light", intent: "primary" }), "px-4 py-2.5 text-sm")}
        >
          Apply preview
        </button>
        <button
          type="button"
          onClick={resetDefaults}
          className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2.5 text-sm")}
        >
          Reset to product defaults
        </button>
      </div>
      {saved ? (
        <p className="mt-2 text-sm text-ds-success">Theme preview applied for this organization on this device.</p>
      ) : null}
    </Card>
  );
}
