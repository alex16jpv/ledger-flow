import type { NextRequest } from "next/server";

import { requestPasswordReset } from "@/lib/auth/handlers";

export async function POST(request: NextRequest) {
  return requestPasswordReset(request);
}
