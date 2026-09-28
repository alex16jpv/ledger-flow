import type { NextRequest } from "next/server";

import { cancelEmailChange, requestEmailChange } from "@/lib/auth/handlers";

export async function POST(request: NextRequest) {
  return requestEmailChange("request", request);
}

export async function DELETE(request: NextRequest) {
  return cancelEmailChange(request);
}
