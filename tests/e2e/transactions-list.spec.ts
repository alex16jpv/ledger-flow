import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
const SEED = { email: "seed@ledgerflow.test", password: "LedgerFlow!2026" };
type Request = Parameters<Parameters<typeof test>[2]>[0]["request"];

async function signIn(page: Page, request: Request) {
  const response = await request.post("/api/auth/login", { headers: { origin: APP }, data: SEED });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
}

test("the list groups last month's seed by day, filters from the URL and survives a reload", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto("/transactions?period=lastMonth");
  await expect(page.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Quick expense/ }).first()).toBeVisible();
  await expect(page.getByText("Spent in Last month")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("button", { name: "Expenses" }).click();
  await expect(page).toHaveURL(/period=lastMonth/);
  await expect(page).toHaveURL(/type=EXPENSE/);
  await expect(page.getByRole("button", { name: "Expenses", pressed: true })).toBeVisible();

  await page.getByRole("button", { name: /^Filters/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await sheet.getByRole("switch", { name: "Only quick expenses to review" }).click();
  await expect(sheet.getByRole("button", { name: /^Show \d+ transactions?$/ })).toBeVisible();
  await sheet.getByRole("button", { name: /^Show / }).click();
  await expect(page).toHaveURL(/pending=1/);

  await page.reload();
  await expect(page.getByRole("button", { name: "Expenses", pressed: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Filters/ })).toContainText("3");
  const rows = page.getByRole("button", { name: /To review/ });
  await expect(rows.first()).toBeVisible();
  expect(await page.getByRole("button", { name: /Tinto|Corner café/ }).count()).toBe(0);
});

test("the search narrows the loaded rows and clearing filters restores the month", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto("/transactions?period=lastMonth");
  await expect(page.getByRole("button", { name: /Quick expense/ }).first()).toBeVisible();
  await page.getByRole("searchbox", { name: /Search description/ }).fill("#coffee");
  await expect(page).toHaveURL(/q=%23coffee/);
  await expect(page.getByRole("button", { name: /Quick expense/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /#coffee/ }).first()).toBeVisible();

  await page.getByRole("searchbox", { name: /Search description/ }).fill("zzzz-nothing");
  await expect(page.getByRole("heading", { name: "No movements match" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/transactions$/);
});

test("without network the cached list stays visible under the offline banner", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto("/transactions?period=lastMonth");
  const firstRow = page.getByRole("button", { name: /Quick expense/ }).first();
  await expect(firstRow).toBeVisible();

  await page.context().setOffline(true);
  await expect(page.getByText("You’re offline.")).toBeVisible();
  await expect(firstRow).toBeVisible();
  await expect(page.getByText("Spent in Last month")).toBeVisible();

  await page.context().setOffline(false);
  await expect(page.getByText("Back online.")).toBeVisible();
  await expect(firstRow).toBeVisible();
});
