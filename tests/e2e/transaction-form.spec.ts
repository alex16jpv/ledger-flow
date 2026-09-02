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

function uniqueAmount(): number {
  return 100_000 + Math.floor(Math.random() * 899_999);
}

async function findByAmount(request: Request, amount: number) {
  const list = (await (await request.get("/api/transactions?limit=50")).json()) as {
    data: {
      id: string;
      amount: number;
      type: string;
      description: string | null;
      tags: string[];
      fromAccountId: string | null;
      toAccountId: string | null;
      categoryId: string | null;
    }[];
  };
  return list.data.find((row) => row.amount === amount);
}

test("a transaction is created, edited and deleted from the full form", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  const amount = uniqueAmount();
  await page.goto(`/transactions/new?amount=${amount}&description=E2E%20taxi`);
  await expect(page.getByRole("heading", { level: 1, name: "New transaction" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Description/ })).toHaveValue("E2E taxi");
  await page.getByRole("button", { name: /^Category/ }).click();
  await page
    .getByRole("dialog", { name: "Category" })
    .getByRole("option", { name: /Transportation/ })
    .click();
  await page.getByRole("button", { name: /^Account/ }).click();
  await page.getByRole("dialog", { name: "Account" }).getByRole("option", { name: /Cash/ }).click();
  await page.getByRole("textbox", { name: /^Tags/ }).fill("e2e");
  await page.keyboard.press("Enter");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.getByText("Transaction saved")).toBeVisible();

  const created = await findByAmount(request, amount);
  expect(created).toMatchObject({ type: "EXPENSE", description: "E2E taxi", tags: ["e2e"] });
  expect(created?.categoryId).toBeTruthy();

  await page.goto(`/transactions/${created?.id}/edit`);
  await expect(page.getByRole("heading", { level: 1, name: "Edit transaction" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Description/ })).toHaveValue("E2E taxi");
  await expect(page.getByRole("button", { name: "Remove tag e2e" })).toBeVisible();
  await page.getByRole("textbox", { name: /^Description/ }).fill("E2E taxi home");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved")).toBeVisible();
  expect((await findByAmount(request, amount))?.description).toBe("E2E taxi home");

  await page.goto(`/transactions/${created?.id}/edit`);
  await page.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this transaction?" });
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Transaction deleted")).toBeVisible();
  expect((await request.get(`/api/transactions/${created?.id}`)).status()).toBe(404);
});

test("a transfer refuses the same account on both sides and swaps them", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  const amount = uniqueAmount();
  await page.goto("/transactions/new");
  await page.getByRole("button", { name: "Transfer" }).click();
  await page.getByRole("textbox", { name: "Amount" }).fill(String(amount));
  await page.getByRole("button", { name: /^From/ }).click();
  await page
    .getByRole("dialog", { name: "Account" })
    .getByRole("option", { name: /Bancolombia/ })
    .click();
  await page.getByRole("button", { name: /^To/ }).click();
  const toOptions = page.getByRole("dialog", { name: "Account" }).getByRole("option");
  await expect(toOptions.filter({ hasText: "Bancolombia" })).toHaveCount(0);
  await toOptions.filter({ hasText: "Savings" }).click();
  await page.getByRole("button", { name: "Swap accounts" }).click();
  await expect(page.getByRole("button", { name: /^From.*Savings/ })).toBeVisible();
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.getByText("Transaction saved")).toBeVisible();
  const created = await findByAmount(request, amount);
  expect(created?.type).toBe("TRANSFER");
  expect(created?.fromAccountId).not.toBe(created?.toAccountId);
  await request.delete(`/api/transactions/${created?.id}`, { headers: { origin: APP } });
});

test("an adjustment sends only the chosen side and a far-future date is refused inline", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  const amount = uniqueAmount();
  await page.goto("/transactions/new");
  await page.getByRole("button", { name: "Adjustment" }).click();
  await expect(page.getByRole("button", { name: /^Category/ })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Amount" }).fill(String(amount));
  await page.getByRole("button", { name: /^Account/ }).click();
  await page.getByRole("dialog", { name: "Account" }).getByRole("option", { name: /Cash/ }).click();
  await page.getByRole("button", { name: "Decrease balance" }).click();
  await page.getByRole("textbox", { name: "Date" }).fill("2031-01-01");
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "That date is more than a day ahead." }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Date" }).fill("2026-09-01");
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.getByText("Transaction saved")).toBeVisible();
  const created = await findByAmount(request, amount);
  expect(created).toMatchObject({ type: "ADJUSTMENT", toAccountId: null, categoryId: null });
  expect(created?.fromAccountId).toBeTruthy();
  await request.delete(`/api/transactions/${created?.id}`, { headers: { origin: APP } });
});
