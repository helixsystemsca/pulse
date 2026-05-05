import { NextResponse } from "next/server";

/**
 * Placeholder facility schedule endpoint.
 * The worker dashboard polls this route; until an Xplor/real schedule integration is wired,
 * return an empty list (prevents repeated 404 noise in the console/network tab).
 */
export async function GET() {
  return NextResponse.json([], { status: 200 });
}

