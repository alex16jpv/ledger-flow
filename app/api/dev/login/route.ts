import { NextRequest, NextResponse } from "next/server";

import { authenticate } from "@/lib/auth/handlers";
import { safeNextPath } from "@/lib/auth/routes";
import { isEnabled } from "@/lib/flags";

// Development-only helper so headless screenshots can open authenticated screens.
export async function GET(request: Request) {
  if (!isEnabled("devLogin")) return new NextResponse(null, { status: 404 });
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const password = url.searchParams.get("password");
  if (!email || !password)
    return NextResponse.json(
      { error: "BadRequest", message: "email and password required" },
      { status: 400 },
    );
  const login = await authenticate(
    "/auth/login",
    new NextRequest(`${url.origin}/api/auth/login`, {
      method: "POST",
      headers: { origin: url.origin, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  if (!login.ok) return login;
  const response = NextResponse.redirect(
    new URL(safeNextPath(url.searchParams.get("next")), url.origin),
    303,
  );
  login.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") response.headers.append("set-cookie", value);
  });
  return response;
}
