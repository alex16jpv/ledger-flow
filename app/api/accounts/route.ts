import { NextRequest, NextResponse } from "next/server";
import { proxy } from "@/lib/api/proxy";
import { validateOrigin } from "@/lib/api/csrf";
import { createAccountSchema } from "@/lib/schemas/account.schema";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const params: Record<string, string> = {};

  for (const key of ["limit", "offset", "cursor", "ids"]) {
    const value = searchParams.get(key);
    if (value) params[key] = value;
  }

  const result = await proxy("/accounts", { params });

  return NextResponse.json(result, { status: result.status });
}

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

  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, status: 422, error: parsed.error.issues[0].message },
      { status: 422 },
    );
  }

  const result = await proxy("/accounts", {
    method: "POST",
    body: parsed.data,
  });

  return NextResponse.json(result, { status: result.status });
}
