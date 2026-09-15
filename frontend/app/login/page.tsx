import { headers } from "next/headers";
import { LoginPageClient } from "./LoginPageClient";
import { resolveAuthBrand } from "@/lib/branding/auth-brand";
import { requestHostnameFromHeaders } from "@/lib/pulse-host";

export default function LoginPage() {
  const hostname = requestHostnameFromHeaders((name) => headers().get(name));
  const brand = resolveAuthBrand(hostname);
  return <LoginPageClient brand={brand} />;
}
