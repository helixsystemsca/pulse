/**
 * Pulse host rewrite: for configured worker hostnames, `/` → `/login` so the marketing homepage
 * is not served on the Pulse subdomain. Override hosts with `PULSE_APP_HOSTNAMES` (comma-separated).
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPulseAppHostnameSet } from "@/lib/pulse-host";

function hostnameForRequest(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-host");
  if (forwarded) {
    return forwarded.split(",")[0].trim().toLowerCase().split(":")[0];
  }
  return request.nextUrl.hostname.toLowerCase();
}

export function middleware(request: NextRequest) {
  const host = hostnameForRequest(request);
  if (!getPulseAppHostnameSet().has(host)) {
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
