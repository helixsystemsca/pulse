"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  bypassRowsFromRbacKeys,
  moduleKeysFromBypassRows,
  RBAC_BYPASS_FEATURES,
  rbacKeysFromBypassRows,
  type RbacBypassFeature,
} from "@/config/platform/rbac-bypass-options";
import { cn } from "@/lib/cn";
import { dsCheckboxClass } from "@/styles/form-controls";

const LABEL = "text-[11px] font-bold uppercase tracking-wide text-ds-muted";
const FIELD =
  "mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground";

export type BypassRowDraft = {
  id: string;
  featureKey: string;
  levelId: string;
};

type Props = {
  enabled: boolean;
  onEnabledChange: (on: boolean) => void;
  rows: BypassRowDraft[];
  onRowsChange: (rows: BypassRowDraft[]) => void;
  disabled?: boolean;
};

function newRowId(): string {
  return `bypass-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultRow(): BypassRowDraft {
  const feat = RBAC_BYPASS_FEATURES[0]!;
  return { id: newRowId(), featureKey: feat.featureKey, levelId: feat.levels[0]!.id };
}

export function WorkerPermissionBypassPanel({ enabled, onEnabledChange, rows, onRowsChange, disabled }: Props) {
  return (
    <div className="mt-4 rounded-lg border border-ds-border/80 bg-ds-secondary/15 p-3">
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          className={cn(dsCheckboxClass, "mt-0.5")}
          checked={enabled}
          disabled={disabled}
          onChange={(e) => {
            const on = e.target.checked;
            onEnabledChange(on);
            if (on && rows.length === 0) {
              onRowsChange([defaultRow()]);
            }
          }}
        />
        <span>
          <span className="text-sm font-semibold text-ds-foreground">Permission bypass</span>
          <p className="mt-0.5 text-xs leading-relaxed text-ds-muted">
            Grant specific feature permissions beyond the department role matrix — e.g. edit procedures for an
            Operations team member.
          </p>
        </span>
      </label>

      {enabled ? (
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <BypassRowEditor
              key={row.id}
              row={row}
              disabled={disabled}
              onChange={(next) => {
                onRowsChange(rows.map((r) => (r.id === row.id ? next : r)));
              }}
              onRemove={
                rows.length > 1 ? () => onRowsChange(rows.filter((r) => r.id !== row.id)) : undefined
              }
            />
          ))}
          <button
            type="button"
            disabled={disabled}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-ds-border px-2.5 py-1.5 text-xs font-semibold text-ds-muted hover:border-[var(--ds-accent)]/40 hover:text-ds-foreground"
            onClick={() => onRowsChange([...rows, defaultRow()])}
          >
            <Plus className="h-3.5 w-3.5" />
            Add feature override
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BypassRowEditor({
  row,
  disabled,
  onChange,
  onRemove,
}: {
  row: BypassRowDraft;
  disabled?: boolean;
  onChange: (row: BypassRowDraft) => void;
  onRemove?: () => void;
}) {
  const feat = RBAC_BYPASS_FEATURES.find((f) => f.featureKey === row.featureKey) ?? RBAC_BYPASS_FEATURES[0]!;
  const levels = feat.levels;

  return (
    <div className="grid gap-2 rounded-lg border border-ds-border/60 bg-ds-primary/80 p-2.5 sm:grid-cols-[1fr_1fr_auto]">
      <div>
        <label className={LABEL}>Feature</label>
        <select
          className={FIELD}
          disabled={disabled}
          value={row.featureKey}
          onChange={(e) => {
            const nextFeat = RBAC_BYPASS_FEATURES.find((f) => f.featureKey === e.target.value) as
              | RbacBypassFeature
              | undefined;
            if (!nextFeat) return;
            onChange({
              ...row,
              featureKey: nextFeat.featureKey,
              levelId: nextFeat.levels[0]!.id,
            });
          }}
        >
          {RBAC_BYPASS_FEATURES.map((f) => (
            <option key={f.featureKey} value={f.featureKey}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL}>Permission level</label>
        <select
          className={FIELD}
          disabled={disabled}
          value={row.levelId}
          onChange={(e) => onChange({ ...row, levelId: e.target.value })}
        >
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      {onRemove ? (
        <button
          type="button"
          disabled={disabled}
          className="flex h-9 w-9 items-center justify-center self-end rounded-lg border border-ds-border text-ds-muted hover:bg-ds-secondary hover:text-ds-danger sm:mb-0.5"
          aria-label="Remove override"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <div className="hidden sm:block" />
      )}
    </div>
  );
}

export function buildBypassPayload(enabled: boolean, rows: BypassRowDraft[]) {
  if (!enabled || rows.length === 0) {
    return { rbac_permission_extra: [] as string[], feature_allow_extra: [] as string[] };
  }
  const slim = rows.map((r) => ({ featureKey: r.featureKey, levelId: r.levelId }));
  return {
    rbac_permission_extra: rbacKeysFromBypassRows(slim),
    feature_allow_extra: moduleKeysFromBypassRows(slim),
  };
}

export function bypassDraftFromProfile(keys: readonly string[] | undefined): {
  enabled: boolean;
  rows: BypassRowDraft[];
} {
  const parsed = bypassRowsFromRbacKeys(keys ?? []);
  if (parsed.length === 0) {
    return { enabled: false, rows: [defaultRow()] };
  }
  return {
    enabled: true,
    rows: parsed.map((r) => ({ id: newRowId(), ...r })),
  };
}
