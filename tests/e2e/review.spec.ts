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

test("Save all completes the categorized cards in one request", async ({ page, request }) => {
  // A fresh user: the batch sweeps every categorized card of the inbox, so sharing the seed inbox
  // with the other specs would let it swallow their rows mid-flight.
  const email = `e2e-saveall-${Date.now()}-${Math.random().toString(16).slice(2)}@ledgerflow.test`;
  await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Save All E2E", email, password: "LedgerFlow!2026" },
  });
  await request.post("/api/accounts", {
    headers: { origin: APP },
    data: { name: "Wallet", type: "CASH", color: "GRAY", balance: 100_000 },
  });
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
  await expect(page.getByRole("button", { name: /^Save all/ })).toHaveCount(0);
  for (const [index, name] of [
    [0, "Food"],
    [1, "Transportation"],
  ] as const) {
    await cards[index]!.getByRole("button", { name: "Other" }).click();
    await page.getByRole("dialog", { name: "Category" }).getByRole("option", { name }).click();
  }
  await cards[1]!.getByRole("textbox", { name: "Description" }).fill("E2E batch");

  const patches: string[] = [];
  page.on("request", (sent) => {
    if (sent.method() === "PATCH") patches.push(sent.url());
  });
  await page.getByRole("button", { name: "Save all · 2" }).click();
  const dialog = page.getByRole("dialog", { name: "Save 2 expenses?" });
  await dialog.getByRole("button", { name: "Save 2" }).click();
  await expect(page.getByText("2 expenses saved")).toBeVisible();
  await expect(page.getByRole("heading", { name: "All reviewed" })).toBeVisible();
  expect(patches.filter((url) => url.endsWith("/api/transactions/batch"))).toHaveLength(1);

  for (const id of ids) {
    const row = (await (await request.get(`/api/transactions/${id}`)).json()) as {
      pendingDetails: boolean;
      description: string | null;
    };
    expect(row.pendingDetails).toBe(false);
  }
});
