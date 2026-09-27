import type { NextRequest } from "next/server";

import { confirmEmail } from "@/lib/auth/handlers";

export async function POST(request: NextRequest) {
  return confirmEmail("/auth/email/not-me", request);
}
