import type { NextRequest } from "next/server";

import { resendSignUp } from "@/lib/auth/handlers";

export async function POST(request: NextRequest) {
  return resendSignUp(request);
}
