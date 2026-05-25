"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/pulse/Card";
import { ThemeColorTokenField } from "@/components/organization/ThemeColorTokenField";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { dsFormHintClass } from "@/components/ui/ds-form-classes";
import { cn } from "@/lib/cn";
import {
  applyOrganizationTheme,
  DEFAULT_ORGANIZATION_THEME,
  dispatchOrganizationThemeChange,
  normalizeOrganizationTheme,
  resolveOrganizationTheme,
  THEME_BRAND_TOKEN_META,
  THEME_SEMANTIC_TOKEN_META,
  writeStoredOrganizationTheme,
  type OrganizationTheme,
  type ThemeBrandColorKey,
  type ThemeSemanticColorKey,
} from "@/lib/theme/organization-branding";
import { buttonVariants } from "@/styles/button-variants";

type Props = {
  companyId: string;
};

export function OrganizationBrandingThemeSection({ companyId }: Props) {
  const [draft, setDraft] = useState<OrganizationTheme>(() => normalizeOrganizationTheme(DEFAULT_ORGANIZATION_THEME));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(resolveOrganizationTheme({ id: companyId, name: "" }));
    setSaved(false);
  }, [companyId]);

  useEffect(() => {
    applyOrganizationTheme(normalizeOrganizationTheme(draft));
  }, [draft]);

  const setBrand = (key: ThemeBrandColorKey, value: string) => {
    setSaved(false);
    setDraft((prev) => ({
      ...prev,
      brand: { ...prev.brand, [key]: value },
    }));
  };

  const setSemantic = (key: ThemeSemanticColorKey, value: string) => {
    setSaved(false);
    setDraft((prev) => ({
      ...prev,
      semantic: { ...prev.semantic, [key]: value },
    }));
  };

  const persist = useCallback(() => {
    const normalized = normalizeOrganizationTheme(draft);
    setDraft(normalized);
    writeStoredOrganizationTheme(companyId, normalized);
    dispatchOrganizationThemeChange();
    setSaved(true);
  }, [companyId, draft]);

  const resetDefaults = () => {
    setDraft(normalizeOrganizationTheme(DEFAULT_ORGANIZATION_THEME));
    setSaved(false);
  };

  return (
    <Card variant="secondary" padding="lg">
      <SectionHeader
        title="Theme tokens"
        description="Industrial operations UI palette — core brand identity separate from KPI and status semantics. Changes preview live; save persists for this organization on this device."
      />

      <section className="mt-6" aria-labelledby="theme-brand-heading">
        <div className="border-b border-ds-border pb-3">
          <h3 id="theme-brand-heading" className="text-sm font-semibold text-ds-foreground">
            Core theme
          </h3>
          <p className="mt-1 text-xs text-ds-muted">
            Navigation, layouts, buttons, hovers, gradients, and interactive chrome. Not used for compliance or
            alert KPIs.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {THEME_BRAND_TOKEN_META.map((meta) => (
            <ThemeColorTokenField
              key={meta.key}
              label={meta.label}
              purpose={meta.purpose}
              value={draft.brand[meta.key as ThemeBrandColorKey]}
              onChange={(hex) => setBrand(meta.key as ThemeBrandColorKey, hex)}
            />
          ))}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="theme-semantic-heading">
        <div className="border-b border-ds-border pb-3">
          <h3 id="theme-semantic-heading" className="text-sm font-semibold text-ds-foreground">
            KPI / status colors
          </h3>
          <p className="mt-1 text-xs text-ds-muted">
            Operational meaning only — success, caution, and critical states stay consistent across themes and
            modules.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_SEMANTIC_TOKEN_META.map((meta) => (
            <ThemeColorTokenField
              key={meta.key}
              label={meta.label}
              purpose={meta.purpose}
              value={draft.semantic[meta.key as ThemeSemanticColorKey]}
              onChange={(hex) => setSemantic(meta.key as ThemeSemanticColorKey, hex)}
            />
          ))}
        </div>
        <p className={cn(dsFormHintClass, "mt-3")}>
          Critical maps to <code className="font-mono text-[11px]">--ds-danger</code> for existing operational
          components.
        </p>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={persist}
          className={cn(buttonVariants({ surface: "light", intent: "primary" }), "px-4 py-2.5 text-sm")}
        >
          Save & apply
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
        <p className="mt-2 text-sm text-ds-success">Theme saved for this organization on this device.</p>
      ) : (
        <p className="mt-2 text-xs text-ds-muted">Live preview is active while you edit. Save to persist across sessions.</p>
      )}
    </Card>
  );
}
