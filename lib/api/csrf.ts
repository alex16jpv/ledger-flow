import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  `http://localhost:${process.env.PORT ?? "3001"}`,
  "http://localhost:3001",
].filter(Boolean);

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
