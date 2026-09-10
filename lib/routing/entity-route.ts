import { isEntityId } from "@/lib/api/entity-id";
import { DETAIL_TEMPLATES, SHELL_PATHS } from "@/lib/pwa/shell";

// Same reason as the `/dev/` guard in `proxy.ts` (W-39): `(app)/loading.tsx` starts streaming before
// a page runs, so a `notFound()` down there arrives as a 200 with the not-found body inside. This is
// a routing fact, so the proxy decides it and says so in a header the group's layout obeys.
export const UNKNOWN_ROW_HEADER = "x-lf-unknown-row";

// A detail route's `[id]` matches any segment. The templates say which position holds a row id, so a
// segment that is not one cannot name a row and the address is refused without asking the server. A
// well-formed id the app does not know is a different state: it renders and shows its own error,
// which the copy on the device can answer with no network.
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
