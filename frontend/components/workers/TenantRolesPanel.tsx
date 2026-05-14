"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/pulse/Card";
import { MODULE_LABEL, PRODUCT_MODULE_PERMISSION_SECTIONS } from "@/config/platform/tenant-product-modules";
import type { CanonicalFeatureKey } from "@/lib/features/canonical-features";
import {
  createTenantRole,
  deleteTenantRole,
  fetchTenantRoles,
  patchTenantRole,
  type TenantRoleRow,
} from "@/lib/tenantRolesService";

const FIELD =
  "mt-1 w-full rounded-ds-md border border-ds-border bg-ds-surface px-3 py-2 text-sm text-ds-foreground";

type Props = {
  apiCompanyId: string | undefined;
  canEdit: boolean;
};

export function TenantRolesPanel({ apiCompanyId, canEdit }: Props) {
  const [roles, setRoles] = useState<TenantRoleRow[]>([]);
  const [catalog, setCatalog] = useState<CanonicalFeatureKey[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftFeatures, setDraftFeatures] = useState<CanonicalFeatureKey[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTenantRoles(apiCompanyId);
      setRoles(data.items);
      setCatalog(data.catalog_feature_keys);
      setSelectedId((prev) => {
        if (prev && data.items.some((r) => r.id === prev)) return prev;
        return data.items[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, [apiCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = roles.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setDraftName(selected.name);
      setDraftFeatures([...selected.feature_keys]);
    } else {
      setDraftName("");
      setDraftFeatures([]);
    }
  }, [selected]);

  const toggleFeature = (key: CanonicalFeatureKey) => {
    setDraftFeatures((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].sort(),
    );
  };

  const handleCreate = async () => {
    if (!newRoleName.trim() || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createTenantRole({ name: newRoleName.trim(), feature_keys: [] }, apiCompanyId);
      setNewRoleName("");
      await load();
      setSelectedId(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create role");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selected || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      await patchTenantRole(
        selected.id,
        { name: draftName.trim(), feature_keys: draftFeatures },
        apiCompanyId,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected || !canEdit) return;
    if (!window.confirm(`Delete role "${selected.name}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteTenantRole(selected.id, apiCompanyId);
      setSelectedId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete role");
    } finally {
      setSaving(false);
    }
  };

  if (loading && roles.length === 0) {
    return (
      <Card variant="secondary" padding="md">
        <p className="text-sm text-ds-muted">Loading roles…</p>
      </Card>
    );
  }

  if (catalog.length === 0) {
    return (
      <Card variant="secondary" padding="md">
        <h2 className="text-sm font-bold tracking-tight text-ds-foreground">Roles & features</h2>
        <p className="mt-2 text-xs text-ds-muted">
          No product modules are on this tenant contract yet. Ask your system administrator to enable features for
          your organization.
        </p>
      </Card>
    );
  }

  return (
    <Card variant="secondary" padding="md">
      <h2 className="text-sm font-bold tracking-tight text-ds-foreground">Roles & features</h2>
      <p className="mt-1 text-xs text-ds-muted">
        Create roles, toggle modules per role, and assign a role to each person on their profile. The sidebar shows
        only modules granted by the user&apos;s role (within your contract). New roles start with no modules until you
        enable them.
      </p>
      {error ? <p className="mt-2 text-xs text-ds-danger">{error}</p> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,220px)_1fr]">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Roles</p>
          <ul className="space-y-1">
            {roles.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full rounded-ds-md px-3 py-2 text-left text-sm ${
                    selectedId === r.id
                      ? "bg-ds-primary text-ds-primary-foreground"
                      : "bg-ds-surface text-ds-foreground hover:bg-ds-muted/20"
                  }`}
                >
                  {r.name}
                  <span className="ml-1 text-[11px] opacity-70">({r.user_count})</span>
                </button>
              </li>
            ))}
          </ul>
          {canEdit ? (
            <div className="flex gap-2 pt-2">
              <input
                className={FIELD}
                placeholder="New role name"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
              />
              <button
                type="button"
                disabled={saving || !newRoleName.trim()}
                onClick={() => void handleCreate()}
                className="shrink-0 rounded-ds-md bg-ds-primary px-3 py-2 text-xs font-semibold text-ds-primary-foreground disabled:opacity-50"
              >
                Add
              </button>
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          {selected ? (
            <>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-ds-muted">
                Role name
              </label>
              <input
                className={FIELD}
                value={draftName}
                disabled={!canEdit}
                onChange={(e) => setDraftName(e.target.value)}
              />
              <div className="mt-4 space-y-6">
                {PRODUCT_MODULE_PERMISSION_SECTIONS.map((section) => {
                  const mods = section.keys.filter((k) => catalog.includes(k));
                  if (mods.length === 0) return null;
                  return (
                    <div key={section.id}>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-ds-foreground">{section.label}</h3>
                      {section.description ? (
                        <p className="mt-1 text-[11px] text-ds-muted">{section.description}</p>
                      ) : null}
                      <div className="mt-3 space-y-2">
                        {mods.map((mod) => {
                          const on = draftFeatures.includes(mod);
                          return (
                            <label
                              key={mod}
                              className="ds-inset-panel flex cursor-pointer items-center justify-between gap-3 px-3 py-2"
                            >
                              <span className="text-sm font-medium text-ds-foreground">
                                {MODULE_LABEL[mod] ?? mod}
                              </span>
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={!canEdit}
                                onChange={() => toggleFeature(mod)}
                                className="h-4 w-4"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {canEdit ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSave()}
                    className="rounded-ds-md bg-ds-primary px-4 py-2 text-sm font-semibold text-ds-primary-foreground disabled:opacity-50"
                  >
                    Save role
                  </button>
                  <button
                    type="button"
                    disabled={saving || selected.user_count > 0}
                    onClick={() => void handleDelete()}
                    className="rounded-ds-md border border-ds-border px-4 py-2 text-sm text-ds-muted disabled:opacity-50"
                  >
                    Delete role
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-ds-muted">Select a role or create one to configure module access.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
