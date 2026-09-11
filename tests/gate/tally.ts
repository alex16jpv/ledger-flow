import type { Page } from "@playwright/test";

export interface Call {
  method: string;
  path: string;
  search: string;
  // How many operations a `POST /sync` carried, so the report can say the queue left in one request.
  operations?: number;
}

// §4.2: every /api call in order, so a phase is measured by slicing the log.
export class Tally {
  readonly calls: Call[] = [];

  watch(page: Page): void {
    page.on("request", (request) => {
      const { pathname, search } = new URL(request.url());
      if (!pathname.startsWith("/api/")) return;
      const body =
        pathname === "/api/sync" && request.method() === "POST"
          ? (request.postDataJSON() as { operations?: unknown[] } | null)
          : null;
      this.calls.push({
        method: request.method(),
        path: pathname,
        search,
        ...(body?.operations ? { operations: body.operations.length } : {}),
      });
    });
  }

  mark(): number {
    return this.calls.length;
  }

  since(mark: number): Call[] {
    return this.calls.slice(mark);
  }
}

const DATA = /^\/api\/(accounts|categories|transactions|budgets|stats|users)/;
export const reads = (calls: Call[]): Call[] =>
  calls.filter((c) => c.method === "GET" && DATA.test(c.path));
export const pushes = (calls: Call[]): Call[] =>
  calls.filter((c) => c.method !== "GET" && DATA.test(c.path));
export const pulls = (calls: Call[]): Call[] => calls.filter((c) => c.path === "/api/sync/changes");
// Since O-F5b `pushes` counts the ordinary routes — nothing now — and `batches` the real ones.
export const batches = (calls: Call[]): Call[] =>
  calls.filter((c) => c.method === "POST" && c.path === "/api/sync");
export const health = (calls: Call[]): Call[] =>
  calls.filter((c) => c.path.startsWith("/api/health"));
