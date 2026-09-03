import { expect, type Page, test } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
const SEED = { email: "seed@ledgerflow.test", password: "LedgerFlow!2026" };
const MISSING_ACCOUNT = "01920000-0000-7000-8000-0000000000ff";
// Not found has its own friendly state; a malformed id fails with the generic screen error and its reference.
const BROKEN_ACCOUNT = "not-an-account-id";
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
  const failed = page.waitForResponse(
    (response) => response.url().includes(`/api/accounts/${BROKEN_ACCOUNT}`) && !response.ok(),
  );
  await page.goto(`/accounts/${BROKEN_ACCOUNT}`);
  const response = await failed;
  const requestId = response.request().headers()["x-request-id"];
  expect(requestId).toBeTruthy();
  expect(response.headers()["x-request-id"]).toBe(requestId);
  await expect(page.getByText(`Reference: ${requestId}`)).toBeVisible();
});

test("the monitoring tunnel path is left alone by the locale middleware", async ({ request }) => {
  const response = await request.get("/monitoring", { maxRedirects: 0 });
  expect(response.status()).toBe(404);
  expect(response.headers()["content-security-policy-report-only"]).toBeUndefined();
});
