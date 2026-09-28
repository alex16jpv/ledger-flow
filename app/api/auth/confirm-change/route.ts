import type { NextRequest } from "next/server";

import { confirmEmailChange } from "@/lib/auth/handlers";

export async function POST(request: NextRequest) {
  return confirmEmailChange(request);
}
