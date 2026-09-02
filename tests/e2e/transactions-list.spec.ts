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

test("a row opens its detail, which edits and deletes the transaction", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  const amount = 100_000 + Math.floor(Math.random() * 899_999);
  const created = (await (
    await request.post("/api/transactions/quick", {
      headers: { origin: APP },
      data: { amount },
    })
  ).json()) as { id: string };

  await page.goto("/transactions");
  // The mobile and desktop projects each create a quick row: pick this one by its unique amount.
  await page
    .getByRole("button", { name: new RegExp(`Quick expense.*${amount.toLocaleString("en-US")}`) })
    .click();
  await expect(page).toHaveURL(new RegExp(`/transactions/${created.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Transaction" })).toBeVisible();
  await expect(
    page.getByText("This quick expense still needs a category and a description."),
  ).toBeVisible();
  await expect(page.getByText("Quick add")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(new RegExp(`/transactions/${created.id}/edit$`));
  await page.getByRole("textbox", { name: /^Description/ }).fill("E2E detailed");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/transactions$/);

  await page.goto(`/transactions/${created.id}`);
  await expect(page.getByRole("heading", { level: 2, name: "E2E detailed" })).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await page
    .getByRole("dialog", { name: "Delete this transaction?" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText("Transaction deleted")).toBeVisible();
  expect((await request.get(`/api/transactions/${created.id}`)).status()).toBe(404);
});
