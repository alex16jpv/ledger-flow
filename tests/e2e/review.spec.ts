import { expect, type Page, test, uniqueEmail } from "../fixtures";
import { vaultState } from "../offline";
import { expectNoAxeViolations } from "./axe";

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
  await expectNoAxeViolations(page);

  await card.getByRole("button", { name: "Coffee" }).click();
  await card.getByRole("combobox", { name: "Description" }).fill("E2E latte");
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

// T-98: the inbox offered every card expense categories, so the server refused a quick income.
test("the inbox completes a quick income with a category the server accepts", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  const amount = 100_000 + Math.floor(Math.random() * 899_999);
  const created = (await (
    await request.post("/api/transactions/quick", {
      headers: { origin: APP },
      data: { amount, type: "INCOME" },
    })
  ).json()) as { id: string };
  await page.goto(`/transactions/review?focus=${created.id}`);
  const card = page.locator(`[data-transaction-id="${created.id}"]`);
  await expect(card).toBeVisible();
  // The chips are its own type's, and not one of them belongs to an expense.
  await expect(card.getByRole("button", { name: "Salary" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Coffee" })).toHaveCount(0);

  await card.getByRole("button", { name: "Other" }).click();
  await page
    .getByRole("dialog", { name: "Category" })
    .getByRole("option", { name: "Salary" })
    .click();
  await card.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Details saved")).toBeVisible();
  await expect(card).toHaveCount(0);

  const row = (await (await request.get(`/api/transactions/${created.id}`)).json()) as {
    type: string;
    pendingDetails: boolean;
    categoryId: string | null;
  };
  expect(row).toMatchObject({ type: "INCOME", pendingDetails: false });
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

test("Save all completes the categorized cards, one guarded operation per row", async ({
  page,
  request,
}) => {
  // A fresh user: the batch sweeps every categorized card, so a shared inbox would be swallowed.
  const email = uniqueEmail("saveall");
  const registered = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Save All E2E", email, password: "LedgerFlow!2026" },
  });
  expect(registered.ok(), await registered.text()).toBe(true);
  const wallet = await request.post("/api/accounts", {
    headers: { origin: APP },
    data: { name: "Wallet", type: "CASH", color: "GRAY", balance: 100_000 },
  });
  expect(wallet.ok(), await wallet.text()).toBe(true);
  const ids: string[] = [];
  for (const amount of [12_500, 15_400]) {
    const created = (await (
      await request.post("/api/transactions/quick", { headers: { origin: APP }, data: { amount } })
    ).json()) as { id: string };
    ids.push(created.id);
  }
  await page.context().addCookies((await request.storageState()).cookies);

  await page.goto("/transactions/review");
  const cards = ids.map((id) => page.locator(`[data-transaction-id="${id}"]`));
  await expect(cards[0]!).toBeVisible();
  // H-08: with no mirror yet `writeAll` sends each row direct (O-F4), which is not the route asserted below.
  await expect
    .poll(async () => (await vaultState(page))?.syncedAt, { timeout: 30_000 })
    .toEqual(expect.any(String));
  await expect(page.getByRole("button", { name: /^Save all/ })).toHaveCount(0);
  for (const [index, name] of [
    [0, "Food"],
    [1, "Transportation"],
  ] as const) {
    await cards[index]!.getByRole("button", { name: "Other" }).click();
    await page.getByRole("dialog", { name: "Category" }).getByRole("option", { name }).click();
  }
  await cards[1]!.getByRole("combobox", { name: "Description" }).fill("E2E batch");

  // F-20 with O-F5b: one operation per row, travelling as one `POST /sync`, never the API's batch.
  const sentUrls: string[] = [];
  const batches: { entity: string; action: string; id: string; baseUpdatedAt?: string }[][] = [];
  page.on("request", (sent) => {
    if (sent.method() === "PUT" || sent.method() === "PATCH") sentUrls.push(sent.url());
    if (sent.method() === "POST" && sent.url().endsWith("/api/sync")) {
      const body = sent.postDataJSON() as {
        operations: { entity: string; action: string; id: string; baseUpdatedAt?: string }[];
      };
      batches.push(body.operations);
    }
  });
  await page.getByRole("button", { name: "Save all · 2" }).click();
  const dialog = page.getByRole("dialog", { name: "Save 2 entries?" });
  await dialog.getByRole("button", { name: "Save 2" }).click();
  await expect(page.getByText("2 entries saved")).toBeVisible();
  await expect(page.getByRole("heading", { name: "All reviewed" })).toBeVisible();
  // F-77: the toast can be on screen before Playwright saw the request, so the batch is polled.
  await expect.poll(() => batches).toHaveLength(1);
  expect(sentUrls.filter((url) => url.endsWith("/api/transactions/batch"))).toHaveLength(0);
  const operations = batches[0]!;
  expect(operations.map((operation) => `${operation.entity}:${operation.action}`)).toEqual([
    "transaction:update",
    "transaction:update",
  ]);
  expect(operations.map((operation) => operation.id).sort()).toEqual([...ids].sort());
  expect(operations.every((operation) => typeof operation.baseUpdatedAt === "string")).toBe(true);

  for (const id of ids) {
    const row = (await (await request.get(`/api/transactions/${id}`)).json()) as {
      pendingDetails: boolean;
      description: string | null;
    };
    expect(row.pendingDetails).toBe(false);
  }
});

// T-106: the one sum of every amount read $1,277,900 for this inbox, which meant nothing.
test("Home and the inbox say what went out and what came in, and a transfer in neither", async ({
  page,
  request,
}) => {
  // A fresh user: the figures are the whole inbox's, so a shared one would never add up.
  const email = uniqueEmail("totals");
  const registered = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Totals E2E", email, password: "LedgerFlow!2026" },
  });
  expect(registered.ok(), await registered.text()).toBe(true);
  await request.post("/api/accounts", {
    headers: { origin: APP },
    data: { name: "Wallet", type: "CASH", color: "GRAY", balance: 100_000 },
  });
  const savings = (await (
    await request.post("/api/accounts", {
      headers: { origin: APP },
      data: { name: "Savings", type: "SAVINGS", color: "GREEN", balance: 0 },
    })
  ).json()) as { id: string };
  for (const data of [
    { amount: 12_500 },
    { amount: 15_400 },
    { amount: 1_200_000, type: "INCOME" },
    { amount: 50_000, type: "TRANSFER", toAccountId: savings.id },
  ]) {
    const created = await request.post("/api/transactions/quick", {
      headers: { origin: APP },
      data,
    });
    expect(created.ok(), await created.text()).toBe(true);
  }
  await page.context().addCookies((await request.storageState()).cookies);

  await page.goto("/home");
  const alert = page.getByRole("link", { name: /4 quick entries to review/ });
  await expect(alert).toHaveText("4 quick entries to review · −$27,900 · +$1,200,000");
  await expectNoAxeViolations(page);

  await alert.click();
  const heading = page.getByRole("heading", { level: 1, name: "To review · 4" });
  await expect(heading).toBeVisible();
  const header = page.locator("header", { has: heading });
  await expect(header.getByText("−$27,900")).toBeVisible();
  await expect(header.getByText("+$1,200,000")).toBeVisible();
  await expectNoAxeViolations(page);
});
