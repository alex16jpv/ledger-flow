import { expect, type Page, test } from "@playwright/test";

import { expectNoAxeViolations } from "./axe";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
const SEED = { email: "seed@ledgerflow.test", password: "LedgerFlow!2026" };
type Request = Parameters<Parameters<typeof test>[2]>[0]["request"];

async function signIn(page: Page, request: Request) {
  const response = await request.post("/api/auth/login", { headers: { origin: APP }, data: SEED });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
}

test("home shows the pending alert, the day bars, the top budgets and the latest movements", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1, name: /^Hi, / })).toBeVisible();

  const alert = page.getByRole("link", { name: /quick expenses? to review/ });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/\$\d/);
  await expect(page.getByRole("img", { name: "Spending per day" })).toBeVisible();

  const budgets = page.getByRole("heading", { level: 2, name: "Budgets" });
  await expect(budgets).toBeVisible();
  await expect(page.getByText(/left · on track|with \d+ days? left|Over by/).first()).toBeVisible();

  const recent = page.getByRole("region", { name: "Recent transactions" });
  await expect(recent.getByRole("button").first()).toContainText("To review");
  expect(await recent.getByRole("button").count()).toBe(5);
  await expectNoAxeViolations(page);

  await alert.click();
  await expect(page).toHaveURL(/\/transactions\/review$/);
  await page.goBack();
  await recent.getByRole("button").first().click();
  await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]{36}$/);
});
