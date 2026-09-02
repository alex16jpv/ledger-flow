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

async function signUp(page: Page, request: Request) {
  const response = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: {
      name: "Budgets E2E",
      email: `e2e-budgets-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@ledgerflow.test`,
      password: "LedgerFlow!2026",
    },
  });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
}

test("the list features the global budget, filters by period, navigates months and lists past budgets", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto("/budgets");
  await expect(page.getByRole("heading", { level: 1, name: "Budgets" })).toBeVisible();
  await expect(page.getByText("Global")).toBeVisible();
  await expect(
    page.getByText(/left for \d+ days|left · nothing spent yet|Over by/).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Food" })).toHaveAttribute(
    "href",
    /\/budgets\/[0-9a-f-]{36}\?reference=\d{4}-\d{2}$/,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("button", { name: "Weekly", exact: true }).click();
  await expect(page).toHaveURL(/period=WEEKLY/);
  await expect(page.getByRole("link", { name: "Coffee" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Food" })).toHaveCount(0);
  await page.getByRole("button", { name: "All" }).click();
  await expect(page).not.toHaveURL(/period=/);

  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page).toHaveURL(/reference=\d{4}-\d{2}/);
  await expect(page.getByRole("button", { name: "Next month" })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole("button", { name: "Next month" })).toBeEnabled();

  await page.getByRole("link", { name: "Past budgets" }).click();
  await expect(page).toHaveURL(/\/budgets\/past$/);
  await expect(page.getByRole("button", { name: /^Ended · \d+$/, pressed: true })).toBeVisible();
  await expect(page.getByText("Ended", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Create again" }).first()).toHaveAttribute(
    "href",
    /\/budgets\/new\?from=[0-9a-f-]{36}$/,
  );
  await page.getByRole("button", { name: /^Archived · \d+$/ }).click();
  await expect(page).toHaveURL(/tab=archived/);
  await expect(page.getByText("Archived", { exact: true }).first()).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("a new user sees the empty state and creates the global budget from it", async ({
  page,
  request,
}) => {
  await signUp(page, request);
  await page.goto("/budgets");
  await expect(
    page.getByRole("heading", { name: "Put a ceiling on your small spending" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create a monthly budget" }).click();
  const sheet = page.getByRole("dialog", { name: "A ceiling for the month" });
  await sheet.getByRole("button", { name: "$2,000,000" }).click();
  await sheet.getByRole("button", { name: "Create budget" }).click();
  await expect(page.getByText("Global")).toBeVisible();
  await expect(page.getByText("$2,000,000 left · nothing spent yet")).toBeVisible();
});
