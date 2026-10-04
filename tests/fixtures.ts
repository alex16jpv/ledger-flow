import { type APIRequestContext, expect, test as base } from "@playwright/test";

const RETRIED = new Set(["fetch", "get", "post", "put", "patch", "delete", "head"]);

// F-11: an idle keep-alive socket the server is closing answers `read ECONNRESET`; one retry is enough.
function tolerateReset(request: APIRequestContext): APIRequestContext {
  return new Proxy(request, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== "function" || !RETRIED.has(String(property))) return value;
      const call = value.bind(target) as (...args: unknown[]) => Promise<unknown>;
      return async (...args: unknown[]) => {
        try {
          return await call(...args);
        } catch (error) {
          if (!String(error).includes("ECONNRESET")) throw error;
          return await call(...args);
        }
      };
    },
  });
}

export const test = base.extend({
  request: async ({ request }, runTest) => {
    await runTest(tolerateReset(request));
  },
  context: async ({ context }, runTest) => {
    const missing: string[] = [];
    context.on("console", (message) => {
      if (message.type() === "error" && message.text().includes("MISSING_MESSAGE")) {
        missing.push(message.text());
      }
    });
    await runTest(context);
    expect(missing, "a key its segment's MESSAGE_SCOPES entry does not send").toEqual([]);
  },
});

// The clock alone collides: both projections run the same spec at once and can mint in the same ms.
export const uniqueEmail = (tag: string): string =>
  `e2e-${tag}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@ledgerflow.test`;

// tools/e2e-backend.mjs seeds the 1st of this month in Bogota unless SEED_TODAY says another day,
// and the seed describes that month from the 22nd on and the one before it otherwise.
export interface SeedMonth {
  key: string;
  first: string;
  last: string;
  name: string;
  short: string;
  days: number;
}

export function seedMonth(monthsBefore = 0): SeedMonth {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  const [year = 0, month = 0, day = 1] = (process.env.SEED_TODAY ?? `${today}-01`)
    .split("-")
    .map(Number);
  const at = new Date(Date.UTC(year, month - 1 - (day >= 22 ? 0 : 1) - monthsBefore, 1));
  const days = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0)).getUTCDate();
  const key = at.toISOString().slice(0, 7);
  const label = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(at);
  return {
    key,
    first: `${key}-01`,
    last: `${key}-${String(days)}`,
    name: label({ month: "long", year: "numeric" }),
    short: label({ month: "short" }),
    days,
  };
}

export {
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
