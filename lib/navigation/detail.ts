"use client";

import { usePathname } from "@/lib/i18n/navigation";
import { useMounted } from "@/lib/react/useMounted";

// F-48: one entry per route template, so the server HTML must not mention any row at all.
export function useDetailRouteId(): string | null {
  const pathname = usePathname();
  if (!useMounted()) return null;
  return pathname.split("/")[2] ?? null;
}
