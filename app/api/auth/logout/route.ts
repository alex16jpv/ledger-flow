import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateOrigin } from "@/lib/api/csrf";

export async function POST(req: Request) {
  const originError = validateOrigin(req);
  if (originError) return originError;

  const cookieStore = await cookies();
  cookieStore.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ data: null, status: 200, error: null });
}
