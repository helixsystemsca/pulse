import type { ReactNode } from "react";

type AuthScreenShellProps = {
  children: ReactNode;
  /** Extra classes on the outer auth canvas (e.g. flex alignment). */
  className?: string;
};

/**
 * Full-viewport auth canvas: theme mint or dusk gradient + static aquamarine glow (`::before`).
 * Place inside `login-shell` or `AppMain` so flex-1 fills the available height.
 */
export function AuthScreenShell({ children, className = "" }: AuthScreenShellProps) {
  return (
    <div className={`auth-background ${className}`.trim()}>
      <div className="auth-shell-inner">{children}</div>
    </div>
  );
}
