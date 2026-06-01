import type { Metadata } from "next";
import "@/components/auth/coming-soon-card.css";

export const metadata: Metadata = {
  title: { absolute: "Sign-in | Helix" },
  description: "Sign in to your Helix operations dashboard.",
};

/** Full-viewport sign-in — no app navbar, side rail, or marketing chrome. */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="login-shell login-shell--full flex h-dvh min-h-0 flex-col overflow-hidden">{children}</div>
  );
}
