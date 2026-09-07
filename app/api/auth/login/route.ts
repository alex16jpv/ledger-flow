import { authenticate } from "@/lib/auth/handlers";

export async function POST(request: Request) {
  return authenticate("/auth/login", request);
}
