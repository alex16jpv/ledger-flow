import { NextResponse } from "next/server";

import { backendFetch } from "@/lib/api/backend";

export const dynamic = "force-dynamic";

// Unauthenticated liveness probe for the client heartbeat: 200 when the backend and its database answer.
export async function GET() {
  try {
    const response = await backendFetch("/health/db", { signal: AbortSignal.timeout(5000) });
    return NextResponse.json(
      { ok: response.ok },
      { status: response.ok ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
