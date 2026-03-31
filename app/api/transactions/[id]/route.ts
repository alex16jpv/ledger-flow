import { NextResponse } from "next/server";
import { proxy } from "@/lib/api/proxy";
import { validateOrigin } from "@/lib/api/csrf";
import { updateTransactionSchema } from "@/lib/schemas/transaction.schema";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;

  const result = await proxy(`/transactions/${id}`);

  return NextResponse.json(result, { status: result.status });
}

export async function PUT(req: Request, { params }: RouteContext) {
  const originError = validateOrigin(req);
  if (originError) return originError;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, status: 400, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = updateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, status: 422, error: parsed.error.issues[0].message },
      { status: 422 },
    );
  }

  const result = await proxy(`/transactions/${id}`, {
    method: "PUT",
    body: parsed.data,
  });

  return NextResponse.json(result, { status: result.status });
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const originError = validateOrigin(req);
  if (originError) return originError;

  const { id } = await params;

  const result = await proxy(`/transactions/${id}`, { method: "DELETE" });

  if (result.error) {
    return NextResponse.json(result, { status: result.status });
  }

  return NextResponse.json(
    { data: null, status: 200, error: null },
    { status: 200 },
  );
}
