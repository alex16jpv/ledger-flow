import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api/proxy";
import { validateOrigin } from "@/lib/api/csrf";
import { loginSchema } from "@/lib/schemas/auth.schema";

type LoginResponse = {
  token: string;
  user: Record<string, unknown>;
};

export async function POST(req: Request) {
  const originError = validateOrigin(req);
  if (originError) return originError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, status: 400, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, status: 422, error: parsed.error.issues[0].message },
      { status: 422 },
    );
  }

  const result = await proxy<LoginResponse>("/auth/login", {
    method: "POST",
    body: parsed.data,
  });

  if (result.error || !result.data) {
    return NextResponse.json(
      { data: null, status: result.status, error: result.error },
      { status: result.status },
    );
  }

  const { token, user } = result.data;

  // Sync cookie maxAge with JWT expiry
  let maxAge = 60 * 60 * 24 * 7; // fallback: 7 days
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (typeof payload.exp === "number") {
      maxAge = payload.exp - Math.floor(Date.now() / 1000);
    }
  } catch {
    // Use fallback maxAge if token cannot be decoded
  }

  const cookieStore = await cookies();
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });

  return NextResponse.json({ data: user, status: 200, error: null });
}
