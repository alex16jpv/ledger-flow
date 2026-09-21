import { expect, type Page, test, uniqueEmail } from "../fixtures";
import { expectNoAxeViolations } from "./axe";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
type Request = Parameters<Parameters<typeof test>[2]>[0]["request"];

// Every mutation runs on a throwaway user with its ten seeded categories, so the seed stays untouched.
async function signUp(page: Page, request: Request) {
  const response = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Shared E2E", email: uniqueEmail("shared"), password: "LedgerFlow!2026" },
  });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
}

async function anExpense(request: Request, amount: number, description: string) {
  const accounts = await request.post("/api/accounts", {
    headers: { origin: APP },
    data: { name: `Bancolombia ${description}`, type: "ACCOUNT", balance: 2_000_000 },
  });
  expect(accounts.ok()).toBe(true);
  const categories = await request.get("/api/categories?type=EXPENSE&limit=1", {
    headers: { origin: APP },
  });
  const created = await request.post("/api/transactions", {
    headers: { origin: APP },
    data: {
      type: "EXPENSE",
      amount,
      date: "2026-09-20T20:00:00.000Z",
      description,
      fromAccountId: ((await accounts.json()) as { id: string }).id,
      categoryId: ((await categories.json()) as { data: { id: string }[] }).data[0]?.id,
    },
  });
  expect(created.ok()).toBe(true);
}

test("a person, a group made from a movement already recorded, and what it counts as yours", async ({
  page,
  request,
}) => {
  await signUp(page, request);
  await anExpense(request, 100_000, "Food");

  await page.goto("/shared");
  await expect(page.getByRole("heading", { level: 1, name: "Shared" })).toBeVisible();
  // Nothing at all: the two faces are not drawn, because there is nothing to switch between.
  await expect(page.getByText("Nothing shared yet")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Shared groups$/ })).toHaveCount(0);
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByPlaceholder("Beto Cano").fill("Ana Ruiz");
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(page.getByText("Person added")).toBeVisible();
  // A person you keep is a row of her own, before anything is split with her.
  await expect(page.getByRole("button", { name: /^Settled/ })).toBeVisible();

  await page.getByRole("link", { name: "New shared group" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "New shared group" })).toBeVisible();
  await page.getByPlaceholder("Cartagena trip").fill("Night out");

  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByRole("checkbox", { name: /Ana Ruiz/ }).check({ force: true });
  await page.getByRole("button", { name: "Add 1" }).click();

  await page.getByRole("button", { name: "Pick from my transactions" }).click();
  await page.getByRole("checkbox", { name: /Food/ }).check({ force: true });
  await page.getByRole("button", { name: /^Add 1 · / }).click();
  await expect(page.getByText(/1 selected · /)).toBeVisible();

  await page.getByRole("button", { name: "Create shared group" }).click();

  // The detail leads with what still counts as yours, which splitting does not lower.
  await expect(page.getByRole("heading", { level: 1, name: "Night out" })).toBeVisible();
  await expect(page.getByText(/counts as yours/)).toContainText("total $100,000");
  await expect(page.getByText(/counts as yours/)).toContainText("your share $50,000");
  await expect(page.getByRole("heading", { name: "Expenses · 1" })).toBeVisible();
  await expect(page.getByText("Ana Ruiz")).toBeVisible();
  await expect(page.getByText("Nothing paid yet · owes you $50,000")).toBeVisible();
  await expectNoAxeViolations(page);
});
