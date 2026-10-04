import type { NextRequest } from "next/server";

import { confirmSignUp } from "@/lib/auth/handlers";

export async function POST(request: NextRequest) {
  return confirmSignUp(request);
}
