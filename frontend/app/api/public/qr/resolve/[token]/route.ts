import { NextRequest, NextResponse } from "next/server";
import { buildQrResolveUpstreamUrl } from "@/lib/qr/qr-api-proxy";

type Params = { params: { token: string } };

/** Same-origin proxy for unauthenticated QR scans (dev + production fallback). */
export async function GET(request: NextRequest, { params }: Params) {
  const token = String(params.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ detail: "Invalid QR code." }, { status: 400 });
  }

  const upstream = buildQrResolveUpstreamUrl(token, {
    guest: request.nextUrl.searchParams.get("guest") === "1",
  });
  if (!upstream) {
    return NextResponse.json({ detail: "API is not configured." }, { status: 503 });
  }

  const res = await fetch(upstream, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
