import type { NextRequest } from "next/server";

import { authenticate } from "@/lib/auth/handlers";

export async function POST(request: NextRequest) {
  return authenticate("/auth/login", request);
}
