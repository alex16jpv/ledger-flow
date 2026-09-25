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
  page: async ({ page }, runTest) => {
    const missing: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && message.text().includes("MISSING_MESSAGE")) {
        missing.push(message.text());
      }
    });
    await runTest(page);
    expect(missing, "a key its segment's MESSAGE_SCOPES entry does not send").toEqual([]);
  },
});

// The clock alone collides: both projections run the same spec at once and can mint in the same ms.
export const uniqueEmail = (tag: string): string =>
  `e2e-${tag}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@ledgerflow.test`;

export {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
