import { isEntityId } from "@/lib/api/entity-id";
import { DETAIL_TEMPLATES, SHELL_PATHS } from "@/lib/pwa/shell";

// W-39: `(app)/loading.tsx` streams before the page, so a `notFound()` there arrives as a 200.
export const UNKNOWN_ROW_HEADER = "x-lf-unknown-row";

// A segment that is not an id names no row; a well-formed unknown one renders its own error.
export function namesUnknownRow(path: string): boolean {
  // `/accounts/new` and `/transactions/review` sit where an id would: a real route is never a row.
  if ((SHELL_PATHS as readonly string[]).includes(path)) return false;
  const segments = path.split("/");
  const id = segments[2];
  if (id === undefined) return false;
  const template = [...segments.slice(0, 2), "[id]", ...segments.slice(3)].join("/");
  if (!(DETAIL_TEMPLATES as readonly string[]).includes(template)) return false;
  return !isEntityId(id);
}
