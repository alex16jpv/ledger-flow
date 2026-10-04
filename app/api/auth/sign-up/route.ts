import type { NextRequest } from "next/server";

import { forgetSignUp, pendingSignUp, startSignUp } from "@/lib/auth/handlers";

export function GET(request: NextRequest) {
  return pendingSignUp(request);
}

export async function POST(request: NextRequest) {
  return startSignUp(request);
}

export function DELETE(request: NextRequest) {
  return forgetSignUp(request);
}
