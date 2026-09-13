import { expect, type Page, test } from "@playwright/test";

import { expectNoAxeViolations } from "./axe";

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
  await expectNoAxeViolations(page);

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
  await expectNoAxeViolations(page);
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

test("creating from the list follows the period filter, and Custom goes to the full form", async ({
  page,
  request,
}) => {
  await signUp(page, request);
  await page.goto("/budgets?period=WEEKLY");
  await expect(
    page.getByText("A total weekly budget shows how much is left before the week ends."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create a weekly budget" }).click();
  const sheet = page.getByRole("dialog", { name: "A ceiling for the week" });
  await sheet.getByRole("textbox", { name: "Weekly amount" }).fill("400000");
  await sheet.getByRole("button", { name: "Create budget" }).click();
  await expect(page.getByRole("link", { name: /Weekly budget/ })).toBeVisible();
  await expect(page.getByText(/^Weekly · /)).toBeVisible();

  await page.getByRole("button", { name: "Monthly" }).click();
  await expect(page.getByText("No monthly budgets this month")).toBeVisible();
  await expect(page.getByRole("button", { name: /Create a total monthly budget/ })).toBeVisible();

  await page.getByRole("button", { name: "Custom" }).click();
  await page.getByRole("link", { name: "Create a custom budget" }).click();
  await expect(page).toHaveURL(/\/budgets\/new\?period=CUSTOM$/);
  await expect(
    page.getByRole("group", { name: "Period" }).getByRole("button", { name: "Custom" }),
  ).toHaveAttribute("aria-pressed", "true");
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
  await expectNoAxeViolations(page);

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

  await page.goto("/budgets/past?tab=archived");
  await page.getByRole("button", { name: "Restore Snacks" }).click();
  await expect(page.getByText("Budget restored")).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore Snacks" })).toHaveCount(0);
  await page.goto("/budgets");
  await expect(page.getByText("Snacks", { exact: true })).toBeVisible();

  const archived = await request.delete(`/api/budgets/${id}`, { headers: { origin: APP } });
  expect(archived.ok()).toBe(true);
  const blocker = await request.post("/api/budgets", {
    headers: { origin: APP },
    data: {
      name: "Everything",
      color: "INDIGO",
      categoryIds: [],
      periodType: "MONTHLY",
      amount: 1,
    },
  });
  expect(blocker.status()).toBe(201);
  await page.goto(`/budgets/${id}`);
  await page.getByRole("button", { name: "Restore" }).click();
  const conflict = page.getByRole("dialog", { name: "Another budget is in the way" });
  await expect(conflict).toContainText("“Everything” is active for the same monthly period");
  await expect(conflict.getByRole("link", { name: "Create again" })).toHaveAttribute(
    "href",
    new RegExp(`/budgets/new\\?from=${id}$`),
  );
});

test("the form creates a category budget, refuses a second global one, edits it and copies a past one", async ({
  page,
  request,
}) => {
  await signUp(page, request);
  await page.goto("/budgets/new");
  await expect(page.getByRole("heading", { level: 1, name: "New budget" })).toBeVisible();
  await page.getByRole("textbox", { name: "Name" }).fill("Groceries");
  await page.getByRole("button", { name: "Housing" }).click();
  await page.getByRole("button", { name: "Food" }).click();
  await expect(page.getByRole("button", { name: "Housing", pressed: false })).toBeVisible();
  await page.getByRole("textbox", { name: "Amount" }).fill("650000");
  await page.getByRole("button", { name: "Teal" }).click();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Create budget" }).click();
  await expect(page.getByText("Budget created")).toBeVisible();
  await expect(page).toHaveURL(/\/budgets\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Groceries", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Food/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Housing/ })).toHaveCount(0);

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
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/budgets$/);

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
  // The dates are openers now (F-05), so what they show is the day, not an input value.
  await expect(page.getByRole("button", { name: /^Start/ })).not.toContainText("Jul 1");
});

// Owner report P-24: a user west of the server's zone saw an empty list while the create call said "overlap".
test("a Los Angeles user in USD sees the global budget they just created, formatted in their currency", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: {
      name: "Budgets LA",
      email: `e2e-budgets-la-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@ledgerflow.test`,
      password: "LedgerFlow!2026",
      timezone: "America/Los_Angeles",
      currency: "USD",
    },
  });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
  const created = await request.post("/api/budgets", {
    headers: { origin: APP },
    data: {
      name: "Monthly budget",
      color: "INDIGO",
      categoryIds: [],
      periodType: "MONTHLY",
      amount: 2000,
    },
  });
  expect(created.status()).toBe(201);

  await page.goto("/budgets");
  await expect(page.getByText("Global")).toBeVisible();
  await expect(page.getByText("$2,000.00 left · nothing spent yet")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Put a ceiling on your small spending" }),
  ).toHaveCount(0);
});

// Owner report P-27: a short custom window opened today must show this month and nowhere else.
test("a custom budget for today shows in the current month only", async ({ page, request }) => {
  await signUp(page, request);
  const start = new Date();
  start.setUTCHours(12, 0, 0, 0);
  const end = new Date(start.getTime() + 2 * 86_400_000);
  const created = await request.post("/api/budgets", {
    headers: { origin: APP },
    data: {
      name: "Two days",
      color: "CYAN",
      categoryIds: [],
      periodType: "CUSTOM",
      amount: 100_000,
      periodStartDate: start.toISOString(),
      periodEndDate: end.toISOString(),
    },
  });
  expect(created.status()).toBe(201);

  await page.goto("/budgets");
  await expect(page.getByRole("link", { name: "Two days" })).toBeVisible();
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page).toHaveURL(/reference=\d{4}-\d{2}/);
  await expect(page.getByRole("link", { name: "Two days" })).toHaveCount(0);
});

// T-30: the four cards of the detail, against the real aggregations and its own months.
test("the detail says how the period got here, where it ends and how it compares", async ({
  page,
  request,
}) => {
  const registered = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: {
      name: "Budget charts",
      email: `e2e-charts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@ledgerflow.test`,
      password: "LedgerFlow!2026",
      timezone: "UTC",
    },
  });
  expect(registered.ok(), await registered.text()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
  const { user } = (await registered.json()) as { user: { id: string } };
  expect(user.id).toBeTruthy();

  const account = await request.post("/api/accounts", {
    headers: { origin: APP },
    data: { name: "Charts cash", type: "CASH", balance: 5_000_000 },
  });
  expect(account.ok(), await account.text()).toBe(true);
  const accountId = ((await account.json()) as { id: string }).id;

  const categoryIds: string[] = [];
  for (const name of ["Charts food", "Charts travel"]) {
    const made = await request.post("/api/categories", {
      headers: { origin: APP },
      data: { name, icon: "utensils", color: "ORANGE", type: "EXPENSE" },
    });
    expect(made.ok(), await made.text()).toBe(true);
    categoryIds.push(((await made.json()) as { id: string }).id);
  }

  const today = new Date();
  const monthStart = (back: number) =>
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1, 12));
  const spend = async (back: number, day: number, amount: number, category: number) => {
    const at = monthStart(back);
    at.setUTCDate(day);
    const made = await request.post("/api/transactions", {
      headers: { origin: APP },
      data: {
        type: "EXPENSE",
        amount,
        date: at.toISOString(),
        fromAccountId: accountId,
        categoryId: categoryIds[category],
        description: `Charts ${String(back)}-${String(day)}`,
      },
    });
    expect(made.ok(), await made.text()).toBe(true);
  };
  // Last month went over its 400,000; the one before it did not.
  await spend(1, 5, 450_000, 0);
  await spend(2, 5, 200_000, 0);
  await spend(0, 1, 120_000, 0);
  await spend(0, 2, 60_000, 1);

  const effectiveFrom = monthStart(8);
  const created = await request.post("/api/budgets", {
    headers: { origin: APP },
    data: {
      name: "Charts",
      color: "PINK",
      categoryIds,
      type: "EXPENSE",
      periodType: "MONTHLY",
      amount: 400_000,
      effectiveFrom: effectiveFrom.toISOString(),
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  await page.goto(`/budgets/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Budget" })).toBeVisible();

  const days = page.getByRole("group", { name: "Spending per day" });
  await expect(days).toBeVisible();
  await expect(days.getByRole("button", { name: /\$120,000$/ })).toBeVisible();

  await expect(page.getByRole("img", { name: /against the period’s pace/ })).toBeVisible();
  await expect(page.getByText(/At this rate you finish the period at/)).toBeVisible();

  const history = page.getByRole("group", { name: "Spent against the limit, period by period" });
  await expect(history).toBeVisible();
  const columns = history.getByRole("button");
  await expect(columns).toHaveCount(6);
  await expect(columns.nth(4)).toHaveAccessibleName(/\$450,000 of \$400,000$/);
  await expect(columns.last()).toHaveAccessibleName(/\$180,000 of \$400,000, in progress$/);
  await expect(page.getByText("1 of the 5 finished periods went over.")).toBeVisible();

  const breakdown = page.getByRole("region", { name: "Where it went" });
  await expect(breakdown).toBeVisible();
  await expect(breakdown.getByText("$180,000 of $400,000")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Biggest this period" })).toBeVisible();
  await expectNoAxeViolations(page);

  // Every figure of the four cards comes from the local copy: a reload reads nothing of its own.
  // The session and the sync feed are the shell's, not this screen's, and they go out either way.
  const shell = new Set(["/api/auth/me", "/api/sync/changes"]);
  const reads: string[] = [];
  page.on("request", (sent) => {
    const { pathname } = new URL(sent.url());
    if (pathname.startsWith("/api/") && !shell.has(pathname)) reads.push(pathname);
  });
  await page.reload();
  await expect(page.getByRole("group", { name: "Spending per day" })).toBeVisible();
  expect(reads).toEqual([]);

  // A column is a control: it opens the period it names.
  await columns.first().click();
  await expect(page).toHaveURL(/reference=\d{4}-\d{2}$/);
});
