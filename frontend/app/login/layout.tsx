import type { Metadata } from "next";
import { headers } from "next/headers";
import "@/components/auth/coming-soon-card.css";
import { shouldUseVernonAuthBrand } from "@/lib/branding/auth-brand";
import { requestHostnameFromHeaders } from "@/lib/pulse-host";

export async function generateMetadata(): Promise<Metadata> {
  const hostname = requestHostnameFromHeaders((name) => headers().get(name));
  if (shouldUseVernonAuthBrand(hostname)) {
    return {
      title: { absolute: "Sign-in | City of Vernon" },
      description: "Sign in to City of Vernon recreation operations.",
    };
  }
  return {
    title: { absolute: "Sign-in | Helix" },
    description: "Sign in to your Helix operations dashboard.",
  };
}

/** Full-viewport sign-in — no app navbar, side rail, or marketing chrome. */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="login-shell login-shell--full flex h-dvh min-h-0 flex-col overflow-hidden">{children}</div>
  );
}
