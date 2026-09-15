import { NextRequest, NextResponse } from "next/server";
import { buildQrImageUpstreamUrl } from "@/lib/qr/qr-api-proxy";

type Params = { params: { token: string } };

/** Same-origin proxy for printable QR PNG/SVG (mobile scan labels). */
export async function GET(request: NextRequest, { params }: Params) {
  const token = String(params.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ detail: "Invalid QR code." }, { status: 400 });
  }

  const format = request.nextUrl.searchParams.get("format") === "svg" ? "svg" : "png";
  const upstream = buildQrImageUpstreamUrl(token, format);
  if (!upstream) {
    return NextResponse.json({ detail: "API is not configured." }, { status: 503 });
  }

  const res = await fetch(upstream, { cache: "no-store" });
  const body = await res.arrayBuffer();
  return new NextResponse(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? (format === "svg" ? "image/svg+xml" : "image/png"),
      "Cache-Control": "private, max-age=300",
    },
  });
}
