import { NextResponse } from "next/server";
import { proxy } from "@/lib/api/proxy";
import { validateOrigin } from "@/lib/api/csrf";
import { registerSchema } from "@/lib/schemas/auth.schema";

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

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, status: 422, error: parsed.error.issues[0].message },
      { status: 422 },
    );
  }

  const result = await proxy("/auth/register", {
    method: "POST",
    body: parsed.data,
  });

  return NextResponse.json(result, { status: result.status });
}
