import { isEntityId } from "@/lib/api/entity-id";
import { detailRouteId, SHELL_PATHS } from "@/lib/pwa/shell";

// W-39: `(app)/loading.tsx` streams before the page, so a `notFound()` there arrives as a 200.
export const UNKNOWN_ROW_HEADER = "x-lf-unknown-row";

// A segment that is not an id names no row; a well-formed unknown one renders its own error.
export function namesUnknownRow(path: string): boolean {
  // `/accounts/new` and `/transactions/review` sit where an id would: a real route is never a row.
  if ((SHELL_PATHS as readonly string[]).includes(path)) return false;
  const id = detailRouteId(path);
  return id !== undefined && !isEntityId(id);
}
