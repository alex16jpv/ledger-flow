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

test("stats show the seed month by category, by day and by tag, and drill into the list", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto("/stats?reference=2026-08");
  await expect(page.getByRole("heading", { level: 1, name: "Stats" })).toBeVisible();
  await expect(page.getByText("Total spent")).toBeVisible();
  await expect(page.getByText(/\d+ transactions · average/)).toBeVisible();
  await expect(page.getByRole("img", { name: "Share by category" })).toBeVisible();
  const food = page.getByRole("button", { name: /^Food/ });
  await expect(food).toContainText(/\d+ %/);
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Days" }).click();
  await expect(page).toHaveURL(/groupBy=day/);
  await expect(page.getByRole("group", { name: "Per day" })).toBeVisible();
  await expect(page.getByText("Priciest day")).toBeVisible();
  await expect(page.getByRole("heading", { name: /· highest$/ })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Tags" }).click();
  await expect(page).toHaveURL(/groupBy=tag/);
  await expect(page.getByText(/counts in each of them/)).toBeVisible();
  await expect(page.getByRole("button", { name: /#coffee/ })).toBeVisible();

  await page.getByRole("button", { name: "Income" }).click();
  await expect(page).toHaveURL(/type=INCOME/);
  await expect(page.getByText("Total income")).toBeVisible();

  await page.getByRole("button", { name: "Categories" }).click();
  await expect(page).not.toHaveURL(/groupBy=/);
  await page.getByRole("button", { name: "Expenses" }).click();
  await expect(page).not.toHaveURL(/type=/);
  await page.getByRole("button", { name: /^Food/ }).click();
  await expect(page).toHaveURL(
    /\/transactions\?period=custom&from=2026-08-01&to=2026-08-31&type=EXPENSE&category=/,
  );
  await expect(page.getByRole("button", { name: "Expenses", pressed: true })).toBeVisible();
});
