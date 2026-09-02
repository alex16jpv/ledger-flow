import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
const SEED = { email: "seed@ledgerflow.test", password: "LedgerFlow!2026" };
type Request = Parameters<Parameters<typeof test>[2]>[0]["request"];

async function signIn(page: Page, request: Request, credentials = SEED) {
  const response = await request.post("/api/auth/login", {
    headers: { origin: APP },
    data: credentials,
  });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

// Specs share the seed user and run in parallel: each one uses a unique amount to find its own row.
function uniqueAmount(): number {
  return 100_000 + Math.floor(Math.random() * 899_999);
}

async function quickRow(request: Request, amount: number) {
  const list = (await (await request.get("/api/transactions?source=QUICK&limit=50")).json()) as {
    data: {
      id: string;
      amount: number;
      pendingDetails: boolean;
      description: string | null;
      categoryId: string | null;
    }[];
  };
  return list.data.find((row) => row.amount === amount);
}

function addButton(page: Page) {
  return test.info().project.name === "mobile"
    ? page.getByRole("button", { name: "Add expense" })
    : page.getByRole("button", { name: "Add", exact: true });
}

test("an expense is captured in two interactions, lands in the inbox and can be undone", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await addButton(page).click();
  const sheet = page.getByRole("dialog", { name: "Add expense" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("textbox", { name: "Amount" })).toBeFocused();
  await expect(
    sheet.getByRole("button", { name: /From your main account.*Bancolombia/ }),
  ).toBeVisible();
  await expect(sheet.getByRole("group", { name: "Category" }).getByRole("button")).toHaveCount(6);
  expect((await new AxeBuilder({ page }).include("dialog[open]").analyze()).violations).toEqual([]);

  const amount = uniqueAmount();
  await page.keyboard.type(String(amount));
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Transaction saved")).toBeVisible();

  const created = await quickRow(request, amount);
  expect(created).toMatchObject({ amount, pendingDetails: true });

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Transaction removed")).toBeVisible();
  expect((await request.get(`/api/transactions/${created?.id}`)).status()).toBe(404);
});

test("a chosen category and a note complete the details, and More details carries the draft", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await addButton(page).click();
  const sheet = page.getByRole("dialog", { name: "Add expense" });
  const amount = uniqueAmount();
  await sheet.getByRole("textbox", { name: "Amount" }).fill(String(amount));
  await sheet
    .getByRole("group", { name: "Category" })
    .getByRole("button", { name: "Coffee" })
    .click();
  await sheet.getByRole("textbox", { name: "Quick note (optional)" }).fill("E2E latte");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Transaction saved")).toBeVisible();

  const created = await quickRow(request, amount);
  expect(created).toMatchObject({ description: "E2E latte", pendingDetails: false });
  expect(created?.categoryId).toBeTruthy();
  await request.delete(`/api/transactions/${created?.id}`, { headers: { origin: APP } });

  const onlyCategory = uniqueAmount();
  await addButton(page).click();
  await sheet.getByRole("textbox", { name: "Amount" }).fill(String(onlyCategory));
  await sheet
    .getByRole("group", { name: "Category" })
    .getByRole("button", { name: "Food" })
    .click();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  // The previous toast may still be on screen: wait for the follow-up PUT through the API instead.
  await expect
    .poll(async () => (await quickRow(request, onlyCategory))?.pendingDetails, { timeout: 10_000 })
    .toBe(false);
  const categorized = await quickRow(request, onlyCategory);
  expect(categorized).toMatchObject({ pendingDetails: false, description: null });
  await request.delete(`/api/transactions/${categorized?.id}`, { headers: { origin: APP } });

  await addButton(page).click();
  await sheet.getByRole("textbox", { name: "Amount" }).fill("4500");
  await sheet.getByRole("button", { name: /From your main account/ }).click();
  await page.getByRole("dialog", { name: "Account" }).getByRole("option", { name: /Cash/ }).click();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Account.*Cash/ })).toBeVisible();
  await sheet.getByRole("textbox", { name: "Quick note (optional)" }).fill("Bus");
  await sheet.getByRole("button", { name: "More details" }).click();
  await expect(page).toHaveURL(/\/transactions\/new\?amount=4500&accountId=[^&]+&description=Bus$/);
});

test("without a main account the sheet asks for one instead of failing silently", async ({
  page,
  request,
}) => {
  const email = `e2e-quick-${Date.now()}@ledgerflow.test`;
  await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Quick E2E", email, password: "LedgerFlow!2026" },
  });
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/home");
  await addButton(page).click();
  const sheet = page.getByRole("dialog", { name: "Add expense" });
  await expect(sheet.getByRole("button", { name: /Account.*Choose an account/ })).toBeVisible();
  await sheet.getByRole("textbox", { name: "Amount" }).fill("500");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet.getByRole("alert")).toHaveText(
    "Choose an account: you don’t have a main one yet.",
  );
});

test("holding the add button chains captures", async ({ page, request }) => {
  test.skip(test.info().project.name !== "mobile", "the hold gesture lives on the tab bar");
  await signIn(page, request);
  const fab = addButton(page);
  const box = await fab.boundingBox();
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + (box?.height ?? 0) / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  const sheet = page.getByRole("dialog", { name: "Add expense" });
  await expect(sheet).toBeVisible();
  const amount = uniqueAmount();
  await sheet.getByRole("textbox", { name: "Amount" }).fill(String(amount));
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Transaction saved")).toBeVisible();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("textbox", { name: "Amount" })).toHaveValue("");
  const created = await quickRow(request, amount);
  expect(created).toBeDefined();
  await request.delete(`/api/transactions/${created?.id}`, { headers: { origin: APP } });
});
