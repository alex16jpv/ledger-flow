import { brandIcon } from "@/lib/pwa/brand-icon";

export function GET(request: Request) {
  return brandIcon(512, { maskable: new URL(request.url).searchParams.has("maskable") });
}
