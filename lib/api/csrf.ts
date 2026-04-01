import { NextResponse } from "next/server";

const DEFAULT_PORT = process.env.PORT ?? "3001";

const ALLOWED_ORIGINS = [
  ...(process.env.NEXT_PUBLIC_APP_URL?.split(",").map((o) => o.trim()) ?? []),
  `http://localhost:${DEFAULT_PORT}`,
];

export function validateOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");

  // Non-browser clients (e.g., curl) may not send Origin.
  // In production, you may want to reject requests without an Origin header.
  if (!origin) return null;

  if (ALLOWED_ORIGINS.includes(origin)) return null;

  return NextResponse.json(
    { data: null, status: 403, error: "Forbidden: origin not allowed" },
    { status: 403 },
  );
}
