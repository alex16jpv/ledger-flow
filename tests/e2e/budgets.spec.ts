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

test("the detail adjusts, skips and removes the period amount, then archives the budget", async ({
  page,
  request,
}) => {
  await signUp(page, request);
  const created = await request.post("/api/budgets", {
    headers: { origin: APP },
    data: {
      name: "Snacks",
      color: "AMBER",
      categoryIds: [],
      type: "EXPENSE",
      periodType: "MONTHLY",
      amount: 250_000,
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  await page.goto(`/budgets/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Budget" })).toBeVisible();
  await expect(page.getByText("Snacks", { exact: true })).toBeVisible();
  await expect(page.getByText(/uses the base amount/)).toBeVisible();
  await expect(page.getByRole("button", { name: "All spending" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("button", { name: "Change adjustment" }).click();
  const sheet = page.getByRole("dialog", { name: "Adjust this period" });
  await sheet.getByRole("textbox", { name: /^Amount for/ }).fill("300000");
  await sheet.getByRole("button", { name: "Save adjustment" }).click();
  await expect(page.getByText("Adjustment saved")).toBeVisible();
  await expect(page.getByText(/is adjusted to \$300,000/)).toBeVisible();
  await expect(page.getByText("Adjusted", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("base $250,000")).toBeVisible();

  await page.getByRole("button", { name: "Skip this period" }).click();
  await expect(page.getByText(/doesn’t apply in/)).toBeVisible();
  await page.getByRole("button", { name: "Remove adjustment" }).click();
  await expect(page.getByText("Adjustment removed")).toBeVisible();
  await expect(page.getByText(/uses the base amount/)).toBeVisible();

  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page).toHaveURL(/reference=\d{4}-\d{2}/);
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled();

  await page.getByRole("button", { name: "Archive" }).click();
  await page
    .getByRole("dialog", { name: "Archive Snacks?" })
    .getByRole("button", { name: "Archive" })
    .click();
  await expect(page.getByText("Budget archived")).toBeVisible();
  await expect(page).toHaveURL(/\/budgets$/);
  const detail = (await (await request.get(`/api/budgets/${id}`)).json()) as {
    archivedAt: string | null;
  };
  expect(detail.archivedAt).not.toBeNull();
});

test("the form creates a category budget, refuses a second global one, edits it and copies a past one", async ({
  page,
  request,
}) => {
  await signUp(page, request);
  await page.goto("/budgets/new");
  await expect(page.getByRole("heading", { level: 1, name: "New budget" })).toBeVisible();
  await page.getByRole("textbox", { name: "Name" }).fill("Groceries");
  await page.getByRole("button", { name: "Food" }).click();
  await page.getByRole("button", { name: "Housing" }).click();
  await page.getByRole("textbox", { name: "Amount" }).fill("650000");
  await page.getByRole("button", { name: "Teal" }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Create budget" }).click();
  await expect(page.getByText("Budget created")).toBeVisible();
  await expect(page).toHaveURL(/\/budgets\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Groceries", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Food/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Housing/ })).toBeVisible();

  await request.post("/api/budgets", {
    headers: { origin: APP },
    data: {
      name: "Everything",
      color: "INDIGO",
      categoryIds: [],
      periodType: "MONTHLY",
      amount: 1,
    },
  });
  await page.goto("/budgets/new");
  await page.getByRole("textbox", { name: "Name" }).fill("Second global");
  await page.getByRole("button", { name: "All spending" }).click();
  await page.getByRole("textbox", { name: "Amount" }).fill("500000");
  await page.getByRole("button", { name: "Create budget" }).click();
  await expect(page.getByText("You already have a global monthly budget.")).toBeVisible();

  await page.goto("/budgets");
  await page.getByRole("link", { name: "Groceries" }).click();
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit budget" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue("Groceries");
  await expect(page.getByRole("button", { name: "Food", pressed: true })).toBeVisible();
  await page.getByRole("button", { name: "Weekly", exact: true }).click();
  await expect(page.getByText(/Changing the period clears/)).toBeVisible();
  await page.getByRole("textbox", { name: "Name" }).fill("Groceries weekly");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved")).toBeVisible();
  await expect(page.getByText("Groceries weekly", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Weekly · /)).toBeVisible();

  const ended = await request.post("/api/budgets", {
    headers: { origin: APP },
    data: {
      name: "Old trip",
      color: "CYAN",
      categoryIds: [],
      periodType: "CUSTOM",
      amount: 900_000,
      periodStartDate: "2026-07-01T05:00:00.000Z",
      periodEndDate: "2026-07-15T05:00:00.000Z",
    },
  });
  expect(ended.status()).toBe(201);
  await page.goto("/budgets/past");
  await page.getByRole("link", { name: "Create again" }).click();
  await expect(page).toHaveURL(/\/budgets\/new\?from=/);
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue("Old trip");
  await expect(page.getByRole("button", { name: "Custom", pressed: true })).toBeVisible();
  await expect(page.getByLabel("Start")).not.toHaveValue("2026-07-01");
});
