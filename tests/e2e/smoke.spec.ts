import { expect, test } from "@playwright/test";

import { expectNoAxeViolations } from "./axe";

test("the root page responds and has no accessibility violations", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);

  await expectNoAxeViolations(page);
});

// T-03: `[id]` matches any segment, so every one of these answered 200 and the screen then asked the
// server for a row that cannot exist. A well-formed id stays a 200 on purpose — the copy on the
// device can answer it with no network, and the screen shows its own error when nobody can.
test("an address that cannot name a row answers 404, not a rendered screen", async ({
  page,
  request,
}) => {
  const email = `e2e-404-${Date.now()}-${Math.random().toString(16).slice(2)}@ledgerflow.test`;
  await request.post("/api/auth/register", {
    headers: { origin: process.env.E2E_APP_URL ?? "http://localhost:3002" },
    data: { name: "Not Found E2E", email, password: "LedgerFlow!2026", locale: "en" },
  });
  await page.context().addCookies((await request.storageState()).cookies);

  // The copy first: a visit to `/es/…` leaves the locale cookie in Spanish, and next-intl then sends
  // every default-locale URL to its `/es` twin. It is the public 404, because the status has to be
  // decided above the app group's streaming boundary and Next skips the layout that throws — which is
  // the one that draws the frame.
  const first = await page.goto("/accounts/nope");
  expect(first?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to Home" })).toBeVisible();

  for (const path of [
    "/accounts/nope/edit",
    "/transactions/nope",
    "/transactions/nope/edit",
    "/budgets/nope",
    "/budgets/nope/edit",
    "/categories/nope/edit",
    "/es/accounts/nope",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }

  // A well-formed id stays a 200 on purpose: only the row itself knows whether it exists, and with no
  // network the copy on the device is what answers.
  const known = await page.goto("/accounts/01a08c1f-024c-7bbe-b5b6-38d73bbfd050");
  expect(known?.status()).toBe(200);
});
