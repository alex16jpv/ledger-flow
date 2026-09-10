import { expect, type Page, test } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
const SEED = { email: "seed@ledgerflow.test", password: "LedgerFlow!2026" };
const MISSING_ACCOUNT = "01920000-0000-7000-8000-0000000000ff";
// T-03 took away the only address that reached this state: a malformed id is refused with a 404
// before any screen runs, and a well-formed unknown one gets the friendly not-found state, which
// carries no reference. A 503 is what the design puts the reference under, and the backend cannot be
// asked for one on demand, so this is the mock §1.3 allows.
const BROKEN_ACCOUNT = "01920000-0000-7000-8000-0000000000e0";
type Request = Parameters<Parameters<typeof test>[2]>[0]["request"];

async function signIn(page: Page, request: Request) {
  const response = await request.post("/api/auth/login", { headers: { origin: APP }, data: SEED });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
}

test("the request id sent by the client comes back from the backend through the BFF", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  const requestId = "01920000-0000-7000-8000-0000000000e2";
  const response = await request.get(`/api/accounts/${MISSING_ACCOUNT}`, {
    headers: { "x-request-id": requestId },
  });
  expect(response.status()).toBe(404);
  expect(response.headers()["x-request-id"]).toBe(requestId);
});

test("a failing screen shows the same reference the API call carried", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  // Every attempt, because the read retries a 503 once and the screen prints the last one's id.
  const carried: string[] = [];
  await page.route(`**/api/accounts/${BROKEN_ACCOUNT}`, (route) => {
    const requestId = route.request().headers()["x-request-id"] ?? "";
    carried.push(requestId);
    return route.fulfill({
      status: 503,
      headers: { "content-type": "application/json", "x-request-id": requestId },
      body: JSON.stringify({ code: "DB_UNAVAILABLE", message: "The database is unavailable." }),
    });
  });

  await page.goto(`/accounts/${BROKEN_ACCOUNT}`);
  const reference = page.getByText(/^Reference: /);
  await expect(reference).toBeVisible();

  const shown = (await reference.innerText()).replace("Reference: ", "");
  expect(carried).toContain(shown);
  expect(shown).toBe(carried.at(-1));
});

test("the monitoring tunnel path is left alone by the locale middleware", async ({ request }) => {
  const response = await request.get("/monitoring", { maxRedirects: 0 });
  expect(response.status()).toBe(404);
  expect(response.headers()["content-security-policy-report-only"]).toBeUndefined();
});
