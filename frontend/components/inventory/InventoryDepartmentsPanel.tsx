"use client";

import { useState } from "react";
import {
  createTenantDepartment,
  deleteTenantDepartment,
  fetchTenantDepartments,
  patchTenantDepartment,
  type TenantDepartmentRow,
} from "@/lib/tenantDepartmentsService";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";
const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2 text-sm font-bold");
const SECONDARY_BTN = cn(
  buttonVariants({ surface: "light", intent: "secondary" }),
  "px-3 py-1.5 text-xs font-semibold",
);

type Props = {
  companyId: string | null;
  departments: TenantDepartmentRow[];
  onDepartmentsChange: (rows: TenantDepartmentRow[]) => void;
  canManage: boolean;
  busy?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onError?: (message: string | null) => void;
};

async function reloadDepartments(onDepartmentsChange: (rows: TenantDepartmentRow[]) => void, companyId: string | null) {
  const next = await fetchTenantDepartments(companyId);
  onDepartmentsChange(next);
}

export function InventoryDepartmentsPanel({
  companyId,
  departments,
  onDepartmentsChange,
  canManage,
  busy,
  onBusyChange,
  onError,
}: Props) {
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  async function run<T>(fn: () => Promise<T>) {
    onBusyChange?.(true);
    onError?.(null);
    try {
      return await fn();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Could not update departments");
      return undefined;
    } finally {
      onBusyChange?.(false);
    }
  }

  async function addDepartment() {
    const name = newName.trim();
    if (!name || !canManage) return;
    await run(async () => {
      await createTenantDepartment(
        { name, slug: newSlug.trim() || undefined },
        companyId,
      );
      setNewName("");
      setNewSlug("");
      await reloadDepartments(onDepartmentsChange, companyId);
    });
  }

  async function saveName(row: TenantDepartmentRow) {
    const name = (nameDrafts[row.id] ?? row.name).trim();
    if (!name || !canManage) return;
    await run(async () => {
      await patchTenantDepartment(row.id, { name }, companyId);
      setNameDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      await reloadDepartments(onDepartmentsChange, companyId);
    });
  }

  async function removeDepartment(row: TenantDepartmentRow) {
    if (!canManage) return;
    if (
      !window.confirm(
        `Remove department “${row.name}” (${row.slug})? This fails if inventory items, workers, or roles still reference it.`,
      )
    ) {
      return;
    }
    await run(async () => {
      await deleteTenantDepartment(row.id, companyId);
      await reloadDepartments(onDepartmentsChange, companyId);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-pulse-muted">
        Departments partition inventory, vendors, and worker HR tags for your organization. Add them here or in the
        inventory setup wizard. Slugs are stable identifiers used on items; display names can be edited.
      </p>
      {!canManage ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
          Adding or editing departments requires Manage inventory or company admin access.
        </p>
      ) : null}
      {canManage ? (
        <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 p-4 dark:border-ds-border dark:bg-ds-secondary/60">
          <p className={LABEL}>Add department</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="inv-new-dept-name">
                Display name
              </label>
              <input
                id="inv-new-dept-name"
                className={FIELD}
                value={newName}
                disabled={busy}
                placeholder="e.g. Plant operations"
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="inv-new-dept-slug">
                Slug (optional)
              </label>
              <input
                id="inv-new-dept-slug"
                className={FIELD}
                value={newSlug}
                disabled={busy}
                placeholder="Auto from name (lowercase, a-z0-9_-)"
                onChange={(e) => setNewSlug(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className={`${PRIMARY_BTN} mt-3`}
            disabled={busy || !newName.trim()}
            onClick={() => void addDepartment()}
          >
            Add
          </button>
        </div>
      ) : null}
      <div className="space-y-3">
        <h3 className={LABEL}>Existing departments</h3>
        {departments.length === 0 ? (
          <p className="text-sm text-pulse-muted">No departments yet.{canManage ? " Add one above." : ""}</p>
        ) : (
          departments.map((row) => {
            const draft = nameDrafts[row.id] ?? row.name;
            const dirty = draft.trim() !== row.name;
            return (
              <div
                key={row.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200/90 bg-white p-3 sm:flex-row sm:items-end dark:border-ds-border dark:bg-ds-primary"
              >
                <div className="min-w-0 flex-1">
                  <label className={LABEL} htmlFor={`inv-dept-${row.id}`}>
                    Name
                  </label>
                  {canManage ? (
                    <input
                      id={`inv-dept-${row.id}`}
                      className={FIELD}
                      value={draft}
                      disabled={busy}
                      onChange={(e) => setNameDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    />
                  ) : (
                    <p className="mt-1 text-sm font-medium text-pulse-navy dark:text-gray-100">{row.name}</p>
                  )}
                  <p className="mt-1 font-mono text-xs text-pulse-muted">slug: {row.slug}</p>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={PRIMARY_BTN}
                      disabled={busy || !dirty || !draft.trim()}
                      onClick={() => void saveName(row)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className={SECONDARY_BTN}
                      disabled={busy}
                      onClick={() => void removeDepartment(row)}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
