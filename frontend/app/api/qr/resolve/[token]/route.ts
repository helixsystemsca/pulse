import { NextRequest, NextResponse } from "next/server";
import { buildQrResolveUpstreamUrl } from "@/lib/qr/qr-api-proxy";

type Params = { params: { token: string } };

/** Same-origin proxy for signed-in QR resolve (forwards bearer token). */
export async function GET(request: NextRequest, { params }: Params) {
  const token = String(params.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ detail: "Invalid QR code." }, { status: 400 });
  }

  const upstream = buildQrResolveUpstreamUrl(token, {
    guest: request.nextUrl.searchParams.get("guest") === "1",
    authenticated: true,
  });
  if (!upstream) {
    return NextResponse.json({ detail: "API is not configured." }, { status: 503 });
  }

  const headers: HeadersInit = { Accept: "application/json" };
  const auth = request.headers.get("authorization");
  if (auth) headers.Authorization = auth;

  const res = await fetch(upstream, { headers, cache: "no-store" });
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
