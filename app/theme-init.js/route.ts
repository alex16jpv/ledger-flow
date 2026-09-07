import { THEME_INIT_SCRIPT } from "@/lib/theme/init-script";

export const dynamic = "force-static";

export function GET() {
  return new Response(THEME_INIT_SCRIPT, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
