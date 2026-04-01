import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Hostnames that serve the worker app with `/` → `/login` (same Next.js app, different domain).
 * Set `PULSE_APP_HOSTNAMES` to a comma-separated list to override or add preview/staging hosts.
 */
const DEFAULT_PULSE_APP_HOSTS = ["pulse.helixsystems.ca"];

function pulseAppHostSet(): Set<string> {
  const raw = process.env.PULSE_APP_HOSTNAMES?.trim();
  const parts = raw
    ? raw.split(",").map((h) => h.trim().toLowerCase())
    : DEFAULT_PULSE_APP_HOSTS;
  return new Set(parts.filter(Boolean));
}

function hostnameForRequest(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-host");
  if (forwarded) {
    return forwarded.split(",")[0].trim().toLowerCase().split(":")[0];
  }
  return request.nextUrl.hostname.toLowerCase();
}

export function middleware(request: NextRequest) {
  const host = hostnameForRequest(request);
  if (!pulseAppHostSet().has(host)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (pathname !== "/") {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    /*
     * Skip static assets, image optimizer, and webpack HMR so rewrites never run there.
     * Public files under `/images/*` etc. are matched here but only `/` is rewritten.
     */
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico).*)",
  ],
};
