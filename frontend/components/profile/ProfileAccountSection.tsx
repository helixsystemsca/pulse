"use client";

import { ChevronDown, Loader2, Moon, Sun } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Card } from "@/components/pulse/Card";
import { apiFetch } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

export function ProfileAccountSection({
  microsoftAuth,
  onToast,
  onError,
}: {
  microsoftAuth?: boolean;
  onToast: (msg: string) => void;
  onError: (msg: string | null) => void;
}) {
  const { theme, setTheme } = useTheme();
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  async function onChangePassword() {
    onError(null);
    if (!currentPassword || !newPassword) {
      onError("Enter your current password and a new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      onError("New passwords do not match.");
      return;
    }
    setPwBusy(true);
    try {
      await apiFetch("/api/v1/profile/password", {
        method: "POST",
        json: {
          current_password: currentPassword,
          new_password: newPassword,
        },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onToast("Password updated.");
      setPwOpen(false);
    } catch (e) {
      onError(parseClientApiError(e).message);
    } finally {
      setPwBusy(false);
    }
  }

  const SECONDARY = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2.5");

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-headline text-lg font-extrabold text-ds-foreground">Settings &amp; account</h2>
        <p className="mt-1 text-sm text-ds-muted">
          Security and preferences stay here so your identity card stays focused on how you work.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="lg" variant="secondary" className="transition-[box-shadow] duration-200 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-ds-foreground">Appearance</p>
              <p className="mt-1 text-xs text-ds-muted">Light or dark surface across Pulse.</p>
            </div>
            <span className="rounded-full bg-ds-secondary/80 p-2 text-ds-muted">
              {theme === "dark" ? <Moon className="h-4 w-4" aria-hidden /> : <Sun className="h-4 w-4" aria-hidden />}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(
                SECONDARY,
                theme === "light" && "border-ds-accent bg-ds-accent/10 font-bold text-ds-foreground",
              )}
              onClick={() => setTheme("light")}
            >
              Light
            </button>
            <button
              type="button"
              className={cn(
                SECONDARY,
                theme === "dark" && "border-ds-accent bg-ds-accent/10 font-bold text-ds-foreground",
              )}
              onClick={() => setTheme("dark")}
            >
              Dark
            </button>
          </div>
        </Card>

        <Card padding="lg" variant="secondary" className="transition-[box-shadow] duration-200 hover:shadow-md">
          <p className="text-sm font-extrabold text-ds-foreground">Notifications</p>
          <p className="mt-1 text-xs text-ds-muted">
            Fine-tune alerts alongside the rest of your workspace preferences.
          </p>
          <Link
            href="/settings"
            className={cn(buttonVariants({ surface: "light", intent: "accent" }), "mt-4 inline-flex rounded-xl px-4 py-2 text-xs font-bold")}
          >
            Open organization settings
          </Link>
        </Card>
      </div>

      <Card padding="none" variant="secondary" className="overflow-hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-ds-secondary/40"
          onClick={() => setPwOpen((o) => !o)}
          aria-expanded={pwOpen}
        >
          <div>
            <p className="text-sm font-extrabold text-ds-foreground">Password &amp; sign-in</p>
            <p className="mt-0.5 text-xs text-ds-muted">
              {microsoftAuth ? "Microsoft SSO manages your password." : "Update your Pulse password."}
            </p>
          </div>
          <ChevronDown className={cn("h-5 w-5 shrink-0 text-ds-muted transition-transform", pwOpen && "rotate-180")} />
        </button>
        {pwOpen && !microsoftAuth ? (
          <div className="space-y-4 border-t border-ds-border px-5 py-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={LABEL} htmlFor="acct-current-password">
                  Current password
                </label>
                <input
                  id="acct-current-password"
                  className={FIELD}
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="acct-new-password">
                  New password
                </label>
                <input
                  id="acct-new-password"
                  className={FIELD}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="acct-confirm-password">
                  Confirm new password
                </label>
                <input
                  id="acct-confirm-password"
                  className={FIELD}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" className={SECONDARY} disabled={pwBusy} onClick={() => void onChangePassword()}>
                {pwBusy ? (
                  <>
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
                    Updating…
                  </>
                ) : (
                  "Change password"
                )}
              </button>
            </div>
          </div>
        ) : null}
        {pwOpen && microsoftAuth ? (
          <div className="border-t border-ds-border px-5 py-4 text-sm text-ds-muted">
            Password changes for your account are handled in Microsoft Entra ID / Azure AD.
          </div>
        ) : null}
      </Card>
    </section>
  );
}
