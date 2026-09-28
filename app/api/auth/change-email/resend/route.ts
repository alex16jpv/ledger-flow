import type { NextRequest } from "next/server";

import { requestEmailChange } from "@/lib/auth/handlers";

export async function POST(request: NextRequest) {
  return requestEmailChange("resend", request);
}
