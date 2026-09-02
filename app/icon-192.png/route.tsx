import { brandIcon } from "@/lib/pwa/brand-icon";

export function GET(request: Request) {
  return brandIcon(192, { maskable: new URL(request.url).searchParams.has("maskable") });
}
