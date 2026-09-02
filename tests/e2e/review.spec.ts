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

test("the inbox completes a quick expense in place and the pending counter drops", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  const amount = 100_000 + Math.floor(Math.random() * 899_999);
  const created = (await (
    await request.post("/api/transactions/quick", { headers: { origin: APP }, data: { amount } })
  ).json()) as { id: string };
  await page.goto(`/transactions/review?focus=${created.id}`);
  // Other specs create and delete quick rows in parallel: the exact count is asserted in the unit test.
  await expect(page.getByRole("heading", { level: 1, name: /^To review · \d+$/ })).toBeVisible();
  const card = page.locator(`[data-transaction-id="${created.id}"]`);
  await expect(card).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await card.getByRole("button", { name: "Coffee" }).click();
  await card.getByRole("textbox", { name: "Description" }).fill("E2E latte");
  await card.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Details saved")).toBeVisible();
  await expect(card).toHaveCount(0);

  const row = (await (await request.get(`/api/transactions/${created.id}`)).json()) as {
    pendingDetails: boolean;
    description: string | null;
    categoryId: string | null;
  };
  expect(row).toMatchObject({ pendingDetails: false, description: "E2E latte" });
  expect(row.categoryId).toBeTruthy();
  await request.delete(`/api/transactions/${created.id}`, { headers: { origin: APP } });
});

test("the Complete link on a pending detail lands on its card", async ({ page, request }) => {
  await signIn(page, request);
  const amount = 100_000 + Math.floor(Math.random() * 899_999);
  const created = (await (
    await request.post("/api/transactions/quick", { headers: { origin: APP }, data: { amount } })
  ).json()) as { id: string };
  await page.goto(`/transactions/${created.id}`);
  await page.getByRole("link", { name: "Complete" }).click();
  await expect(page).toHaveURL(new RegExp(`/transactions/review\\?focus=${created.id}$`));
  await expect(page.locator(`[data-transaction-id="${created.id}"]`)).toBeVisible();
  await request.delete(`/api/transactions/${created.id}`, { headers: { origin: APP } });
});
