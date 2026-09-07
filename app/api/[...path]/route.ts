import type { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/api/proxy";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ path: string[] }>;
}

async function handle(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return proxyToBackend(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
